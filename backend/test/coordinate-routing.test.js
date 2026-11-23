const {test}=require('node:test');
const assert=require('node:assert/strict');
const api=import('../routing/route-service.mjs');
const snap=import('../routing/snap-points.mjs');
const core=import('../experiments/shadow-routing/core.mjs');
function graph(){
  const nodes=[{id:'a',xy:[0,0]},{id:'b',xy:[100,0]},{id:'c',xy:[50,40]}],byId=new Map(nodes.map(n=>[n.id,n]));
  return {config:{center:{lat:40.45,lon:-3.73}},nodes,edges:[['a','b'],['a','c'],['c','b']].map(([source,target])=>{const a=byId.get(source).xy,b=byId.get(target).xy;return {source,target,geometry:[a,b],lengthM:Math.hypot(b[0]-a[0],b[1]-a[1]),forward:true,reverse:true};})};
}
async function request(){const {unproject}=await core,g=graph();return {graph:'local',origin:unproject(0,0,g.config.center),destination:unproject(100,0,g.config.center),at:'2026-11-23T12:20:00+01:00',sun:{elevationDeg:35,azimuthDeg:180}};}
test('coordenadas: rápida sin addon y equilibrio 50% elige desvio sombreado',async()=>{
  const {createRouteService}=await api;let calls=0;
  const service=createRouteService({loadGraph:()=>graph(),hasCoverage:()=>true,getAddon:()=>({getShadow:(x,y,xx,yy)=>{calls++;return y>40.450001||yy>40.450001?1:0;}})});
  const input=await request(),fast=await service.plan({...input,mode:'fastest'});assert.ok(Math.abs(fast.lengthM-100)<1e-7);assert.equal(calls,0);assert.equal(fast.sunM,null);
  const balanced=await service.plan(input);assert.equal(balanced.shadePreference,.5);assert.ok(balanced.lengthM>100&&balanced.lengthM<130);assert.ok(balanced.sunM<1e-7);
  assert.equal(balanced.comparison.samePath,false);assert.ok(balanced.comparison.savedSunM>99);assert.ok(balanced.comparison.fastest.sunM>99);
  const noPreference=await service.plan({...input,shadePreference:0});assert.ok(Math.abs(noPreference.lengthM-100)<1e-7);
  const lowPreference=await service.plan({...input,shadePreference:.2});assert.ok(Math.abs(lowPreference.lengthM-100)<1e-7);assert.equal(lowPreference.comparison.samePath,true);
  assert.equal(noPreference.comparison.reason,'preference-zero');assert.equal(noPreference.comparison.fastest,null);
  const onlyShade=await service.plan({...input,shadePreference:1});assert.ok(onlyShade.sunM<1e-7);assert.ok(onlyShade.shadow.cacheHit);
});

test('coordenadas: cambiar el sol o la franja invalida la foto y puede cambiar la ruta',async()=>{
  const {createRouteService}=await api,input=await request();let calls=0;
  const service=createRouteService({loadGraph:()=>graph(),hasCoverage:()=>true,getAddon:()=>({getShadow:(x,y,xx,yy,elev,azim)=>{
    calls++;const detour=y>40.450001||yy>40.450001;return azim<-.1?Number(detour):Number(!detour);
  }})});
  const first=await service.plan(input);assert.equal(first.comparison.samePath,false);
  const before=calls;await service.plan(input);assert.equal(calls,before);
  const changed=await service.plan({...input,sun:{elevationDeg:35,azimuthDeg:90}});assert.equal(changed.comparison.samePath,true);assert.ok(calls>before);
  const after=calls;await service.plan({...input,at:'2026-11-23T12:30:00+01:00'});assert.ok(calls>after);
});
test('coordenadas: dos posiciones en la misma arista conservan el sentido',async()=>{
  const {snapRoutePoints}=await snap,{unproject}=await core,g=graph();g.edges=[{...g.edges[0],reverse:false}];
  const {createRouteService}=await api,service=createRouteService({loadGraph:()=>g,getAddon:()=>{throw Error('No se usa');},hasCoverage:()=>false});
  const a=unproject(20,0,g.config.center),b=unproject(80,0,g.config.center),input=await request();
  const split=snapRoutePoints(g,a,b);assert.equal(split.graph.edges.length,3);
  const r=await service.plan({...input,origin:a,destination:b,mode:'fastest'});assert.ok(Math.abs(r.lengthM-60)<1e-6);
  await assert.rejects(service.plan({...input,origin:b,destination:a,mode:'fastest'}),/conectado/);
  g.edges[0].reverse=true;
  const reverse=await service.plan({...input,origin:b,destination:a,mode:'fastest',at:'2026-11-23T12:29:50+01:00'});
  assert.ok(Math.abs(reverse.geometry[0].lon-b.lon)<1e-9);
  assert.ok(Math.abs(reverse.geometry.at(-1).lon-a.lon)<1e-9);
  assert.ok(Math.abs(reverse.stageLengthM-14)<1e-7);
  assert.ok(reverse.positionAtStageEnd.lon<b.lon&&reverse.positionAtStageEnd.lon>a.lon);
  const same=await service.plan({...input,origin:a,destination:a,mode:'fastest'});assert.equal(same.lengthM,0);
  await assert.rejects(service.plan({...input,origin:unproject(1000,1000,g.config.center),mode:'fastest'}),/menos de 100 m/);
});
test('coordenadas: sombra desconocida no impide rápida; noche no invoca shader',async()=>{
  const {createRouteService}=await api,input=await request();let calls=0;
  const s=createRouteService({loadGraph:()=>graph(),hasCoverage:()=>false,getAddon:()=>{calls++;return {getShadow:()=>0};}});
  await assert.rejects(s.plan(input),/datos de sombra/);assert.equal(calls,0);
  const fast=await s.plan({...input,mode:'fastest'});assert.ok(fast.lengthM>0);
  const zero=await s.plan({...input,shadePreference:0});assert.equal(zero.shadeM,null);assert.equal(calls,0);
  const night=await s.plan({...input,sun:{elevationDeg:-20,azimuthDeg:180}});assert.equal(night.shadow.provider,'night');assert.equal(night.sunM,0);assert.equal(calls,0);
  assert.equal(night.comparison.reason,'night');assert.equal(night.comparison.samePath,true);
  const {validateRouteRequest}=await api;assert.throws(()=>validateRouteRequest({...input,shadePreference:1.1}));
});

test('coordenadas: sin ventaja solar las rutas coinciden y lo explican',async()=>{
  const {createRouteService}=await api,input=await request();
  const service=createRouteService({loadGraph:()=>graph(),hasCoverage:()=>true,getAddon:()=>({getShadow:()=>0})});
  for(const shadePreference of [.5,1]){
    const r=await service.plan({...input,shadePreference});
    assert.equal(r.comparison.samePath,true);assert.equal(r.comparison.reason,'same-optimum');assert.equal(r.comparison.savedSunM,0);
    assert.ok(Math.abs(r.comparison.fastest.sunM-100)<1e-6);
  }
});

test('coordenadas: la cota espacial evita consultas nativas ajenas al trayecto',async()=>{
  const {createRouteService}=await api,{unproject}=await core,g=graph(),input=await request();
  g.nodes.push({id:'far',xy:[2000,0]});
  g.edges.push({source:'b',target:'far',geometry:[[100,0],[2000,0]],lengthM:1900,forward:true,reverse:true});
  let calls=0;
  const s=createRouteService({loadGraph:()=>g,hasCoverage:()=>true,getAddon:()=>({getShadow:(lon)=>{
    calls++;assert.ok(lon<unproject(200,0,g.config.center).lon,'no consulta el desvío remoto');return 0;
  }})});
  const r=await s.plan(input);assert.ok(Math.abs(r.lengthM-100)<1e-6);assert.ok(calls>0);
});
