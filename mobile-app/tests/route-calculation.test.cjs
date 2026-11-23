'use strict';
/* global __dirname */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
function load(name){
  const filename=path.resolve(__dirname,'../src/components',name+'.ts');
  const exports={};
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('exports','require',code)(exports,name=>name.startsWith('./')?load(name.slice(2)):require(name));
  return exports;
}
const {buildRouteRequest,fetchRoute}=load('route-api');
const {calculateSunPosition}=load('point-shadow-query');
const {routeOverlayScript}=load('route-map-overlay');
const origin={lat:40.45,lon:-3.73},destination={lat:40.451,lon:-3.731};
test('rutas: peso inicial 50%, salida local y sol fijo en la franja de media hora',()=>{
  const r=buildRouteRequest(origin,destination,'2026-06-21','12:24','shade');
  assert.equal(r.shadePreference,.5);assert.equal(r.graph,'campus');
  assert.equal(new Date(r.at).getHours(),12);
  const frame=new Date(Math.floor(Date.parse(r.at)/1800000)*1800000),sun=calculateSunPosition(frame,origin.lat,origin.lon);
  assert.deepEqual(r.sun,{elevationDeg:sun.elevation,azimuthDeg:sun.azimuth});
  assert.throws(()=>buildRouteRequest(origin,destination,'2026-02-30','12:00','shade'));
  assert.throws(()=>buildRouteRequest(origin,destination,'2026-06-21','25:00','shade'));
  assert.throws(()=>buildRouteRequest(origin,destination,'2026-06-21','12:00','shade',1.1));
});
test('rutas: POST transmite puntos y peso; los fallos del servidor se explican',async()=>{
  const request=buildRouteRequest(origin,destination,'2026-06-21','12:00','fastest');
  const result={geometry:[origin,destination],lengthM:150,durationSeconds:100};
  const route=await fetchRoute('http://local',request,undefined,async(url,options)=>{
    assert.equal(url,'http://local/api/routes');assert.equal(options.method,'POST');assert.deepEqual(JSON.parse(options.body),request);
    return {ok:true,json:async()=>result};
  });
  assert.deepEqual(route,result);
  await assert.rejects(fetchRoute('',request,undefined,async()=>({ok:false,json:async()=>({error:'Sin cobertura de sombra'})})),/Sin cobertura/);
  await assert.rejects(fetchRoute('',request,undefined,async()=>({ok:true,json:async()=>({})})),/incompleta/);
});
test('mapa: dibuja ambas alternativas, destaca la elegida y conecta los marcadores',()=>{
  const route={geometry:[origin,destination],snapped:{origin:{coordinate:origin},destination:{coordinate:destination}}};
  const lines=[],bounds=[],map={fitBounds:b=>bounds.push(b)};
  const L={polyline:(points,style)=>{lines.push({points,style});return {addTo:()=>({bindTooltip:()=>({getBounds:()=>points})})};}};
  new Function('L','map',routeOverlayScript({fastest:route,shaded:route,selected:'shade'},origin,destination))(L,map);
  assert.equal(lines.length,4);assert.equal(lines[0].style.color,'#1677b7');assert.equal(lines[1].style.color,'#258443');
  assert.equal(lines[1].style.weight,6);assert.equal(bounds.length,1);assert.equal(lines[2].style.dashArray,'5 5');
  assert.equal(routeOverlayScript(null),'');
});
