'use strict';
/* global __dirname */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');

// Ejecuta los manejadores del componente real con hooks y servicios controlados.
// No solicita GPS real ni necesita un navegador para comprobar sus transiciones.
function screen(){
  const slots=[],effects=[],timers=new Map(),requests=[];let cursor=0,timerId=0,gps;
  const react={
    useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},
    useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},
    useMemo(fn){cursor++;return fn();},
    useEffect(fn,deps){const i=cursor++,previous=slots[i];if(!previous||deps.some((d,j)=>!Object.is(d,previous.deps[j]))){slots[i]={deps};effects.push(()=>{previous?.cleanup?.();slots[i].cleanup=fn();});}},
  };
  const jsx=(type,props)=>({type,props:props||{}});
  const native={StyleSheet:{create:s=>s},Platform:{OS:'web'}};
  for(const name of ['Text','View','TextInput','Button','ScrollView','Pressable'])native[name]=name;
  const modules={react,'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':native,'expo-location':{},'@react-native-community/slider':{default:'Slider'},
    '@/constants/backend':{BACKEND_URL:'http://test',getChunkUrl:()=>''},
    '@/components/Mapa2D':{Mapa2D:'Mapa2D'},'@/components/location-chunk-viewer':{LocationChunkViewer:'LocationChunkViewer'},
    '@/components/ShadowMap':{ShadowMap:'ShadowMap'},'@/components/PointShadowPanel':{PointShadowPanel:'PointShadowPanel'},
    '@/components/point-shadow-query':{buildShadowTimeline:()=>null,calculateSunPosition:()=>({azimuth:180,elevation:35})},
    '@/components/shadow-settings':{DEFAULT_SHADOW_LAYER_SELECTION:{buildings:true,trees:true},useShadowLayerWeights:()=>({weights:{buildings:1,trees:.75},setWeight(){}})}};
  const filename=path.resolve(__dirname,'../src/app/index.tsx');
  const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports={};
  new Function('require','exports','navigator','fetch','setTimeout','clearTimeout','setInterval','clearInterval','alert',compiled)(
    name=>{assert.ok(name in modules,`Dependencia no simulada: ${name}`);return modules[name];},exports,
    {geolocation:{getCurrentPosition:(success,failure)=>{gps={success,failure};}}},
    url=>new Promise(resolve=>requests.push({url,reply:items=>resolve({ok:true,json:async()=>items})})),
    fn=>{timers.set(++timerId,fn);return timerId;},id=>timers.delete(id),()=>0,()=>{},()=>{});
  function render(){cursor=0;const tree=exports.default();while(effects.length)effects.shift()();return tree;}
  function all(node,predicate,result=[]){if(Array.isArray(node)){for(const n of node)all(n,predicate,result);}else if(node&&typeof node==='object'){if(predicate(node))result.push(node);all(node.props?.children,predicate,result);}return result;}
  const get=predicate=>{const found=all(render(),predicate);assert.equal(found.length,1);return found[0].props;};
  const field=label=>get(n=>n.type==='TextInput'&&n.props.accessibilityLabel===label);
  const button=label=>get(n=>n.type==='Pressable'&&n.props.accessibilityLabel===label);
  const text=node=>all(node,n=>n.type==='Text').map(n=>n.props.children).flat().join(' ');
  const tick=async()=>{for(const [id,fn]of [...timers]){timers.delete(id);fn();}await new Promise(resolve=>setImmediate(resolve));};
  render();
  return {render,field,button,requests,tick,
    gps(point){gps.success({coords:{latitude:point.lat,longitude:point.lon}});},deny(){gps.failure();},
    map:()=>get(n=>n.type==='Mapa2D'),
    place:()=>get(n=>n.type==='TextInput'&&n.props.placeholder==='Buscar lugar...'),
    choose(name){get(n=>n.type==='Pressable'&&text(n)===name+' universidad').onPress();},
    names:()=>all(render(),n=>n.type==='Text').map(n=>n.props.children).flat(),
  };
}
const gps={lat:40.45,lon:-3.73},destination={nombre:'Biblioteca',tipo:'universidad',lat:40.4526,lon:-3.7334};
test('elegir un lugar en 2D lo convierte en destino y conserva el origen GPS',async()=>{
  const s=screen();s.gps(gps);s.place().onChangeText('Biblioteca');await s.tick();s.requests[0].reply([destination]);await s.tick();s.choose('Biblioteca');
  assert.equal(s.map().modoBusqueda,'ruta');assert.deepEqual(s.map().origen,gps);assert.deepEqual(s.map().destino,{lat:destination.lat,lon:destination.lon});
  assert.equal(s.field('Origen de la ruta').value,'Mi ubicación actual');assert.equal(s.field('Destino de la ruta').value,'Biblioteca');
  s.field('Destino de la ruta').onChangeText('Otra biblioteca');assert.equal(s.map().destino,null);
});
test('sin permiso de GPS no se usa Madrid como origen; puede elegirse uno manual',async()=>{
  const s=screen();s.deny();s.button('Elegir origen y destino').onPress();assert.equal(s.map().origen,null);
  assert.equal(s.button('Usar mi ubicación actual como origen').disabled,true);
  s.field('Origen de la ruta').onFocus();s.field('Origen de la ruta').onChangeText('Biblioteca');await s.tick();s.requests[0].reply([destination]);await s.tick();s.choose('Biblioteca');
  assert.deepEqual(s.map().origen,{lat:destination.lat,lon:destination.lon});assert.equal(s.map().destino,null);
  s.gps(gps);assert.deepEqual(s.map().origen,{lat:destination.lat,lon:destination.lon});
  s.button('Usar mi ubicación actual como origen').onPress();assert.deepEqual(s.map().origen,gps);
});
test('una respuesta antigua de destino no sustituye resultados al buscar origen',async()=>{
  const s=screen();s.gps(gps);s.button('Elegir origen y destino').onPress();
  s.field('Destino de la ruta').onChangeText('Destino antiguo');await s.tick();
  s.field('Origen de la ruta').onFocus();s.field('Origen de la ruta').onChangeText('Biblioteca');await s.tick();
  s.requests[1].reply([destination]);await s.tick();s.requests[0].reply([{...destination,nombre:'Antiguo'}]);await s.tick();
  assert.ok(s.names().includes('Biblioteca'));assert.ok(!s.names().includes('Antiguo'));s.choose('Biblioteca');
  assert.deepEqual(s.map().origen,{lat:destination.lat,lon:destination.lon});assert.equal(s.map().destino,null);
});
test('limpiar restaura origen GPS y la seleccion en mapa actualiza las etiquetas',()=>{
  const s=screen();s.gps(gps);s.button('Elegir origen y destino').onPress();s.map().onSeleccionarCoordenada(40.46,-3.72);
  assert.equal(s.field('Destino de la ruta').value,'40.460000, -3.720000');assert.deepEqual(s.map().origen,gps);
  s.button('Limpiar destino y usar mi ubicación como origen').onPress();assert.equal(s.map().destino,null);assert.deepEqual(s.map().origen,gps);
});
