import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createCompactRouter} from './compact-routing.mjs';
import {createRollingPlanner} from './rolling-routing.mjs';
import {makeAdjacency,dijkstra,largestComponent} from './routing.mjs';
import {campusExposure} from './campus-exposure.mjs';
const graph=JSON.parse(await fs.readFile(new URL('data/campus-graph.json',import.meta.url),'utf8'));
assert.equal(graph.config.sizeM,4096);
const byId=new Map(graph.nodes.map(n=>[n.id,n])),component=largestComponent(graph.edges),members=new Set(component.nodes);
const candidates=graph.nodes.filter(n=>members.has(n.id));
const nearest=(x,y)=>candidates.reduce((best,n)=>Math.hypot(n.xy[0]-x,n.xy[1]-y)<Math.hypot(best.xy[0]-x,best.xy[1]-y)?n:best).id;
const h=graph.config.sizeM/2;
const endpoints=[nearest(-h,-h),nearest(h,h),nearest(-h,h),nearest(h,-h)];
const exposure=campusExposure(graph.edges,24),start=performance.now(),router=createCompactRouter(graph.edges,exposure),prepared=performance.now();
let comparisons=0;const timings=[],queries=[];
for(const mode of ['distance','shade']){
  const adj=makeAdjacency(graph.edges,exposure,mode);
  for(const a of endpoints)for(const b of endpoints){const t=performance.now(),actual=router.search(a,b,{mode});timings.push(performance.now()-t);const expected=dijkstra(adj,a,b);assert.equal(actual===null,expected===null);if(actual){assert.ok(Math.abs(actual.cost-expected.cost)<1e-6);assert.ok(actual.peakQueue<=router.stats.nodes);queries.push({source:a,target:b,lengthM:actual.lengthM,mode});}comparisons++;}
}
const longest=queries.filter(r=>r.mode==='distance').sort((a,b)=>b.lengthM-a.lengthM)[0];
assert.ok(longest?.lengthM>3000,'El ensayo debe incluir un paseo de mas de 3 km');
const walkStart=performance.now(),planner=createRollingPlanner({edges:graph.edges,target:longest.target,getExposure:slot=>campusExposure(graph.edges,slot)}),potentialMs=performance.now()-walkStart;
let state={node:longest.source},time=12*3600+20*60,lengthM=0,shadeM=0,sunM=0,arrived=false;
const stages=[];
for(let i=0;i<16;i++){
  const before=time,t=performance.now(),r=planner.plan(state,time);const ms=performance.now()-t;
  assert.ok(!r.unreachable);assert.ok(r.lengthM>0);assert.ok(Math.abs(r.lengthM-r.shadeM-r.sunM)<1e-6);
  assert.ok(r.search.visited<=250000);assert.ok(r.timeSeconds>time);
  for(const s of r.segments){assert.ok(s.fromFraction>=0&&s.fromFraction<=1&&s.toFraction>=0&&s.toFraction<=1);const e=graph.edges[s.edgeIndex];assert.ok(s.toFraction>s.fromFraction?e.forward:e.reverse);if(s.from!== '__rolling_position__')assert.ok(planner.remainingDistance(s.to)<planner.remainingDistance(s.from));}
  stages.push({start:before,end:r.timeSeconds,lengthM:r.lengthM,sunM:r.sunM,ms,visited:r.search.visited,bufferMiB:r.search.typedArrayBytes/1048576});
  state=r.state;time=r.timeSeconds;lengthM+=r.lengthM;shadeM+=r.shadeM;sunM+=r.sunM;if(r.arrived){arrived=true;break;}
}
assert.ok(arrived,'La politica protegida debe llegar sin bucles');assert.ok(stages.length>=2);
const t=performance.now();planner.plan({node:longest.source},12*3600+20*60);const cacheFirst=performance.now()-t;
const again=performance.now(),hot=planner.plan({node:longest.source},12*3600+20*60,{penalty:8}),cacheMs=performance.now()-again;assert.ok(hot.search.cacheHit);
timings.sort((a,b)=>a-b);
const report={generatedAt:new Date().toISOString(),scope:graph.config,graph:{nodes:graph.nodes.length,edges:graph.edges.length,components:component.count,largestComponentNodes:component.nodes.length},comparisonQueries:comparisons,compact:{prepareMs:prepared-start,searchMedianMs:timings[Math.floor(timings.length/2)],searchMaxMs:timings.at(-1),typedArrayMiB:router.stats.typedArrayBytes/1048576},example:longest,walk:{arrived,lengthM,shadeM,sunM,durationMinutes:(time-(12*3600+20*60))/60,potentialMs,stages,cacheFirstMs:cacheFirst,cacheHitMs:cacheMs},limitations:['Grafo real OSM; exposicion sintetica, no shader','Caja de ensayo, no limite administrativo','CPU Node local; no benchmark de movil','Buffers excluyen IDs, objetos, copias del worker y renderizado','Politica de avance protegido: no garantiza minimo sol global']};
await fs.writeFile(new URL('output/campus-report.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
