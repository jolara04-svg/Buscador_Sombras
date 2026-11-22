const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const api=import('../routing/victor-adapter.mjs');
const {createNativeRouteClient}=require('../routing/routes.cjs');
function fixture(){
  const nodes=[{id:'a',xy:[0,0]},{id:'b',xy:[100,0]},{id:'c',xy:[50,40]}],map=new Map(nodes.map(n=>[n.id,n]));
  const edges=[['a','b'],['a','c'],['c','b']].map(([source,target])=>{const a=map.get(source).xy,b=map.get(target).xy;return {source,target,forward:true,reverse:true,geometry:[a,b],lengthM:Math.hypot(b[0]-a[0],b[1]-a[1])};});
  return {config:{center:{lat:40.45,lon:-3.73}},nodes,edges};
}
const input={graph:'local',source:'a',target:'b',at:'2026-11-22T12:20:00+01:00',sun:{elevationDeg:35,azimuthDeg:180}};
test('Victor → metros de sombra → Dijkstra; coordenadas y angulos conservan el contrato nativo',async()=>{
  const {createVictorRouteService,victorAngles}=await api,graph=fixture();let calls=0,loads=0;
  const service=createVictorRouteService({loadGraph:()=>graph,hasCoverage:()=>true,getAddon:()=>{loads++;return {getShadow(lon1,lat1,lon2,lat2,elev,azim){calls++;assert.ok(lon1<0&&lon2<0&&lat1>40&&lat2>40);assert.equal(elev,35*Math.PI/180);assert.equal(azim,-Math.PI/2);return lat1>40.450001||lat2>40.450001?1:0;}};}});
  const r=await service.plan(input);assert.ok(r.arrived);assert.equal(r.shadow.provider,'victor-native');assert.ok(r.lengthM>100&&r.lengthM<130);assert.ok(r.sunM<1e-7);assert.equal(r.plannedRoute[0].to,'c');
  assert.equal(r.nextRecalculateAt,'2026-11-22T11:30:00.000Z');assert.equal(r.plannedGeometry.length,2);
  const before=calls,hot=await service.plan({...input,penalty:8});assert.equal(calls,before);assert.equal(loads,1);assert.ok(hot.shadow.cacheHit);
  await service.plan({...input,at:'2026-11-22T12:30:00+01:00'});assert.ok(calls>before);
  assert.deepEqual(victorAngles({elevationDeg:90,azimuthDeg:90}),[Math.PI/2,0]);
});
test('Victor: ausencia de chunk y errores no se convierten en sol ni en pesos sinteticos',async()=>{
  const {createVictorRouteService}=await api;
  const make=(hasCoverage,getShadow)=>createVictorRouteService({loadGraph:()=>fixture(),hasCoverage,getAddon:()=>({getShadow})});
  const r=await make(()=>false,()=>{throw Error('No deberia consultarse');}).plan(input);assert.ok(r.unreachable);assert.equal(r.shadow.unknownEdges,3);
  await assert.rejects(make(()=>true,()=>NaN).plan(input),/fraccion/);
  await assert.rejects(make(()=>true,()=>{throw Error('OpenGL fallo');}).plan(input),/OpenGL fallo/);
});
test('Victor: avance parcial y recálculo con otra foto desde la posicion anterior',async()=>{
  const {createVictorRouteService}=await api,graph={config:{center:{lat:40.45,lon:-3.73}},nodes:[{id:'a',xy:[0,0]},{id:'b',xy:[4000,0]}],edges:[{source:'a',target:'b',forward:true,reverse:true,lengthM:4000,geometry:[[0,0],[4000,0]]}]};
  const service=createVictorRouteService({loadGraph:()=>graph,hasCoverage:()=>true,getAddon:()=>({getShadow:()=>.5})});
  const first=await service.plan(input);assert.equal(first.lengthM,840);assert.equal(first.state.fraction,.21);assert.equal(first.arrived,false);
  const second=await service.plan({...input,source:undefined,state:first.state,at:first.nextRecalculateAt});assert.ok(Math.abs(second.lengthM-2520)<1e-7);assert.ok(Math.abs(second.state.fraction-.84)<1e-7);
});
test('Victor: validacion y limite de llamadas antes de entregar una foto incompleta',async()=>{
  const {validateRouteRequest,evaluateVictorExposure}=await api;
  for(const change of [{at:'2026-11-22T12:20:00'},{sun:{elevationDeg:0,azimuthDeg:180}},{speedMps:0},{penalty:Infinity},{graph:'../../otro'}])assert.throws(()=>validateRouteRequest({...input,...change}));
  assert.throws(()=>evaluateVictorExposure(fixture(),input.sun,()=>.5,()=>true,{maxCalls:1}),/Presupuesto/);
});
function fakeChild(){const child=new EventEmitter();child.kill=()=>{child.killed=true;};return child;}
test('Proceso nativo: rechaza concurrencia, propaga resultados y permite cerrar',async()=>{
  const child=fakeChild();let id;child.send=m=>{id=m.id;};const client=createNativeRouteClient({spawn:()=>child});
  const active=client.plan(input);await assert.rejects(client.plan(input),/ocupado/);child.emit('message',{id,result:{ok:true}});assert.deepEqual(await active,{ok:true});client.close();assert.ok(child.killed);
});
test('Proceso nativo: fallo y timeout no dejan peticiones colgadas y permiten reiniciar',async()=>{
  let child;const client=createNativeRouteClient({timeoutMs:30,spawn:()=>{child=fakeChild();child.send=()=>{};return child;}});
  let active=client.plan(input);child.emit('exit',1,null);await assert.rejects(active,/termino/);
  active=client.plan(input);await assert.rejects(active,/excedio/);assert.ok(child.killed);client.close();
});
test('HTTP: el endpoint une proveedor y ruta; errores de entrada y del proveedor son explicitos',async()=>{
  const express=require('express'),{once}=require('node:events'),{installVictorRoutes}=require('../routing/routes.cjs');
  const {createVictorRouteService}=await api;
  const service=createVictorRouteService({loadGraph:()=>fixture(),hasCoverage:()=>true,getAddon:()=>({getShadow:()=>.5})});
  const app=express();installVictorRoutes(app,{client:service});
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const url=`http://127.0.0.1:${server.address().port}/api/routes`;
  const post=body=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  try{
    let r=await post(input);assert.equal(r.status,200);const body=await r.json();assert.equal(body.shadow.provider,'victor-native');assert.equal(body.lengthM,100);
    r=await post({...input,at:'sin fecha'});assert.equal(r.status,400);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
