const {test}=require('node:test');
const assert=require('node:assert/strict');
const compact=import('../experiments/shadow-routing/compact-routing.mjs');
const original=import('../experiments/shadow-routing/routing.mjs');
test('CSR: coincide con Dijkstra, reutiliza buffers y respeta sentidos, ceros y paralelas',async()=>{
  const {createCompactRouter}=await compact;const {makeAdjacency,dijkstra}=await original;
  let seed=192;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  const edges=[],exposure=[];
  for(let i=0;i<400;i++){edges.push({source:String(random()%60),target:String(random()%60),forward:true,reverse:random()%3===0});const lengthM=random()%100,shadeM=lengthM*(random()%10)/10;exposure.push({lengthM,shadeM,sunM:lengthM-shadeM,unknownM:0,cost:1});}
  const router=createCompactRouter(edges,exposure),bytes=router.stats.typedArrayBytes;
  for(const penalty of [1,4,8])for(const mode of ['shade','distance']){
    const adj=makeAdjacency(edges,exposure.map(e=>({...e,cost:e.shadeM+penalty*e.sunM})),mode);
    for(let i=0;i<60;i++)for(let j=0;j<60;j++){
      const a=router.search(String(i),String(j),{penalty,mode}),b=dijkstra(adj,String(i),String(j));
      assert.equal(a===null,b===null);if(a){assert.ok(Math.abs(a.cost-b.cost)<1e-7);assert.ok(a.peakQueue<=router.stats.nodes);}
    }
  }
  assert.equal(router.stats.typedArrayBytes,bytes);
  assert.throws(()=>router.search('0','1',{penalty:Infinity}));
  const line=[{source:'a',target:'b',forward:true},{source:'b',target:'c',forward:true}];
  const e=line.map(()=>({lengthM:1,shadeM:0,sunM:1,unknownM:0,cost:4}));const r=createCompactRouter(line,e);
  assert.throws(()=>r.search('a','c',{maxVisited:1}),{code:'SEARCH_LIMIT'});
  assert.equal(r.search('a','c').cost,8);assert.equal(r.search('c','a'),null);assert.equal(r.search('x','a'),null);
  assert.equal(createCompactRouter(line,[{...e[0],unknownM:1,cost:null},e[1]]).search('a','c'),null);
  assert.equal(createCompactRouter([],[]).search('a','a'),null);
});
test('CSR: conserva los costes del grafo UCM real para varias penalizaciones',async()=>{
  const fs=require('node:fs/promises');const path=require('node:path');
  const base=path.join(__dirname,'../experiments/shadow-routing');
  const graph=JSON.parse(await fs.readFile(path.join(base,'data/graph.json'),'utf8'));
  const report=JSON.parse(await fs.readFile(path.join(base,'output/report.json'),'utf8'));
  const byId=new Map(report.edges.map(e=>[e.id,e]));const exposure=graph.edges.map(e=>byId.get(e.id));
  const {createCompactRouter}=await compact;const {makeAdjacency,dijkstra}=await original;
  const router=createCompactRouter(graph.edges,exposure);
  for(const penalty of [1,4,8])for(const mode of ['distance','shade']){
    const adj=makeAdjacency(graph.edges,exposure.map(e=>({...e,cost:e.shadeM+penalty*e.sunM})),mode);
    for(let i=0;i<100;i++){const a=graph.nodes[(i*43)%graph.nodes.length].id,b=graph.nodes[(i*97+21)%graph.nodes.length].id;
      const actual=router.search(a,b,{penalty,mode}),expected=dijkstra(adj,a,b);assert.equal(actual===null,expected===null);if(actual)assert.ok(Math.abs(actual.cost-expected.cost)<1e-7);
    }
  }
});
