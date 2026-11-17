// Genera una demo sin servidor a partir de datos locales; no toca shaders.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { makeAdjacency, dijkstra, largestComponent, summarizeRoute } from './routing.mjs';
const read=name=>fs.readFile(new URL(name,import.meta.url),'utf8');
const graph=JSON.parse(await read('data/graph.json'));
const report=JSON.parse(await read('output/report.json'));
assert.equal(report.experiment.sizeM,512);
assert.equal(report.experiment.center.lat,graph.config.center.lat);
assert.equal(report.experiment.center.lon,graph.config.center.lon);
assert.equal(report.edges.length,graph.edges.length);
assert.ok(report.control.passed);
const byId=new Map(report.edges.map(e=>[e.id,e]));
const exposure=graph.edges.map(e=>{const x=byId.get(e.id);assert.ok(x,`Falta peso ${e.id}`);assert.ok(Math.abs(x.lengthM-e.lengthM)<1e-6);assert.equal(x.unknownM,0);return x;});
const byShade=makeAdjacency(graph.edges,exposure),byDistance=makeAdjacency(graph.edges,exposure,'distance');
const component=largestComponent(graph.edges).nodes.sort();
// Seleccion reproducible de un ejemplo con alternativas distintas.
const selected=Array.from({length:24},(_,i)=>component[Math.floor(i*(component.length-1)/23)]);
let best=null;
for(let i=0;i<selected.length;i++)for(let j=i+1;j<selected.length;j++){
  const source=selected[i],target=selected[j];
  const shortest=summarizeRoute(dijkstra(byDistance,source,target),exposure),shaded=summarizeRoute(dijkstra(byShade,source,target),exposure);
  if(!shortest||!shaded||shortest.lengthM<150)continue;
  const saved=shortest.sunM-shaded.sunM;
  if(!best||saved>best.saved)best={source,target,saved,shortest,shaded};
}
assert.ok(best&&best.saved>0,'Se requiere ejemplo con ahorro de sol');
// Referencia independiente Bellman-Ford: todos los destinos para 12 origenes.
function reference(adj,source){const dist=new Map([...adj.keys()].map(n=>[n,Infinity]));dist.set(source,0);for(let i=1;i<adj.size;i++){let changed=false;for(const [a,arcs]of adj)for(const b of arcs){const next=dist.get(a)+b.cost;if(next<dist.get(b.to)){dist.set(b.to,next);changed=true;}}if(!changed)break;}return dist;}
let comparisons=0;
for(const adjacency of [byShade,byDistance])for(const source of selected.slice(0,12)){
  const ref=reference(adjacency,source);
  for(const target of selected){const result=dijkstra(adjacency,source,target),expected=ref.get(target)??Infinity;assert.ok(result?Math.abs(result.cost-expected)<1e-7:expected===Infinity);if(result){let total=0;assert.equal(result.nodes[0],source);assert.equal(result.nodes.at(-1),target);assert.equal(result.nodes.length,result.edgeIndices.length+1);result.edgeIndices.forEach((index,i)=>{const e=graph.edges[index],a=result.nodes[i],b=result.nodes[i+1];assert.ok(e.forward&&e.source===a&&e.target===b||e.reverse&&e.target===a&&e.source===b);total+=adjacency.get(a).find(arc=>arc.index===index&&arc.to===b).cost;});assert.ok(Math.abs(total-result.cost)<1e-7);}comparisons++;}
}
const image=await fs.readFile(new URL('output/mask-and-graph.png',import.meta.url));
const data={graph,exposure,example:{source:best.source,target:best.target},image:`data:image/png;base64,${image.toString('base64')}`};
const routing=(await read('routing.mjs')).replaceAll('export function','function');
const ui=await read('sample3-ui.js');
const script=`const DATA=${JSON.stringify(data)};\n${routing}\n${ui}`;
const page=(await read('sample3-template.html')).replace('/* SAMPLE3_SCRIPT */',()=>script.replaceAll('</script','<\\/script'));
await fs.writeFile(new URL('sample3.html',import.meta.url),page);
const result={comparisons,reference:'Bellman-Ford',nodes:graph.nodes.length,edges:graph.edges.length,componentNodes:component.length,example:best,limitations:'Pesos y mascara precalculados del laboratorio; no ejecuta el modulo nativo.'};
await fs.writeFile(new URL('output/sample3-validation.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify({comparisons,nodes:graph.nodes.length,edges:graph.edges.length,example:{source:best.source,target:best.target,sunSavedM:best.saved,shortestM:best.shortest.lengthM,shadedM:best.shaded.lengthM}},null,2));
