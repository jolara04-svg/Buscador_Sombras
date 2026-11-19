import {createCompactRouter} from './compact-routing.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const results=[];
for(const side of [100,250,400]){
  const edges=[],exposure=[];
  const add=(a,b)=>{edges.push({source:String(a),target:String(b),forward:true,reverse:true});exposure.push({lengthM:1,shadeM:.5,sunM:.5,unknownM:0,cost:2.5});};
  for(let y=0;y<side;y++)for(let x=0;x<side;x++){const a=y*side+x;if(x+1<side)add(a,a+1);if(y+1<side)add(a,a+side);}
  const start=performance.now(),router=createCompactRouter(edges,exposure),prepared=performance.now();
  const times=[];let route;
  for(let i=0;i<5;i++){const t=performance.now();route=router.search('0',String(side*side-1));times.push(performance.now()-t);assert.equal(route.cost,2*(side-1)*2.5);assert.ok(route.peakQueue<=side*side);}
  results.push({side,nodes:router.stats.nodes,edges:edges.length,arcs:router.stats.arcs,prepareMs:prepared-start,searchMs:times,typedArrayMiB:router.stats.typedArrayBytes/1048576,visited:route.visited,peakQueue:route.peakQueue});
}
const report={environment:`Node ${process.version}, ${process.platform}; rejillas sinteticas, CPU local; tiempos no extrapolables a movil`,memoryScope:'Buffers numericos persistentes; no incluye objetos de entrada, IDs, worker, geometria ni imagenes.',results};
await fs.writeFile(new URL('./output/routing-benchmark.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
