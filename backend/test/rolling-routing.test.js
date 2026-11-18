const {test}=require('node:test');
const assert=require('node:assert/strict');
const api=import('../experiments/shadow-routing/rolling-routing.mjs');
const edge=(source,target,lengthM,reverse=true)=>({source,target,lengthM,forward:true,reverse});
const photo=(edges,fractions)=>edges.map((e,i)=>({lengthM:e.lengthM,shadeM:e.lengthM*fractions[i],sunM:e.lengthM*(1-fractions[i]),unknownM:0,cost:e.lengthM*(4-3*fractions[i])}));
test('horizonte: salida 12:20, primer cambio 12:30 y posicion exacta dentro de una calle',async()=>{
  const {createRollingPlanner}=await api,edges=[edge('a','b',3000),edge('b','t',100)];let calls=[];
  const planner=createRollingPlanner({edges,target:'t',getExposure:slot=>{calls.push(slot);return photo(edges,[1,0]);}});
  let r=planner.plan({node:'a'},12*3600+20*60,{speedMps:1});
  assert.equal(r.lengthM,600);assert.equal(r.timeSeconds,12.5*3600);assert.equal(r.state.edgeIndex,0);assert.equal(r.state.fraction,.2);
  r=planner.plan(r.state,r.timeSeconds,{speedMps:1});assert.equal(r.lengthM,1800);assert.equal(r.state.fraction,.8);
  r=planner.plan(r.state,r.timeSeconds,{speedMps:1});assert.ok(r.arrived);assert.equal(r.state.node,'t');assert.ok(Math.abs(r.lengthM-700)<1e-8);assert.equal(r.timeSeconds,13*3600+700);
  assert.deepEqual(calls,[24,25,26]);
});
test('horizonte: una ruta corta termina sin esperar media hora; longitud y coste no se confunden con tiempo',async()=>{
  const {createRollingPlanner}=await api,edges=[edge('a','t',100)];
  const p=createRollingPlanner({edges,target:'t',getExposure:()=>photo(edges,[0])});
  const r=p.plan({node:'a'},0,{speedMps:1,penalty:8});assert.equal(r.durationSeconds,100);assert.equal(r.cost,800);assert.equal(r.timeSeconds,100);assert.ok(r.arrived);
  const done=p.plan({node:'t'},100);assert.ok(done.arrived);assert.equal(done.lengthM,0);
});
test('horizonte: sin salvaguarda puede oscilar; progreso dirigido evita el bucle',async()=>{
  const {createRollingPlanner}=await api,edges=[edge('a','b',2520),edge('b','t',4000),edge('a','c',3000),edge('c','t',3000)];
  const getExposure=slot=>photo(edges,slot%2?[1,0,1,1]:[1,1,0,0]);
  const naive=createRollingPlanner({edges,target:'t',getExposure,preventBacktracking:false});
  let state={node:'a'},time=0;const visited=[];
  for(let i=0;i<4;i++){const r=naive.plan(state,time);state=r.state;time=r.timeSeconds;visited.push(state.node);assert.equal(r.arrived,false);}
  assert.deepEqual(visited,['b','a','b','a']);
  const safe=createRollingPlanner({edges,target:'t',getExposure});state={node:'a'};time=0;let length=0,result;
  for(let i=0;i<5;i++){result=safe.plan(state,time);length+=result.lengthM;state=result.state;time=result.timeSeconds;if(result.arrived)break;}
  assert.ok(result.arrived);assert.ok(Math.abs(length-6520)<1e-7);
});
test('horizonte: no inventa retorno en calle dirigida, rechaza desconocidos y parametros invalidos',async()=>{
  const {createRollingPlanner}=await api,edges=[edge('a','b',100,false),edge('b','t',100,false)];
  const p=createRollingPlanner({edges,target:'t',getExposure:()=>photo(edges,[1,1])});
  assert.throws(()=>p.plan({edgeIndex:0,fraction:.5,direction:-1},0));assert.throws(()=>p.plan({node:'a'},0,{speedMps:0}));
  assert.throws(()=>p.plan({node:'missing'},0));
  const blocked=createRollingPlanner({edges,target:'t',getExposure:()=>[{...photo(edges,[0,0])[0],cost:null,unknownM:100},photo(edges,[0,0])[1]]});
  assert.ok(blocked.plan({node:'a'},0).unreachable);
});
test('horizonte: al cambiar de franja el nuevo camino puede elegir otra rama',async()=>{
  const {createRollingPlanner}=await api,edges=[edge('a','b',1800,false),edge('b','x',1000,false),edge('x','t',1000,false),edge('b','y',1100,false),edge('y','t',1100,false)];
  const p=createRollingPlanner({edges,target:'t',getExposure:slot=>photo(edges,slot===0?[1,1,1,0,0]:[1,0,0,1,1])});
  const first=p.plan({node:'a'},0,{speedMps:1});assert.equal(first.state.node,'b');assert.equal(first.plannedRoute[1].to,'x');
  const second=p.plan(first.state,first.timeSeconds,{speedMps:1});assert.equal(second.plannedRoute[0].to,'y');
});
test('horizonte: conserva avance en sentido inverso y cruza medianoche sin reiniciar franjas',async()=>{
  const {createRollingPlanner}=await api,edges=[edge('t','a',3000)];const slots=[];
  const p=createRollingPlanner({edges,target:'t',getExposure:slot=>{slots.push(slot);return photo(edges,[1]);}});
  const first=p.plan({node:'a'},23*3600+50*60,{speedMps:1});assert.equal(first.timeSeconds,86400);assert.equal(first.state.direction,-1);assert.equal(first.state.fraction,.8);
  const second=p.plan(first.state,first.timeSeconds,{speedMps:1});assert.ok(Math.abs(second.state.fraction-.2)<1e-10);assert.deepEqual(slots,[47,48]);
  const last=p.plan(second.state,second.timeSeconds,{speedMps:1});assert.ok(last.arrived);assert.ok(Math.abs(last.timeSeconds-(23*3600+50*60+3000))<1e-8);
});
test('horizonte: cache limitada reutiliza pesos y buffers; nueva franja invalida preparacion',async()=>{
  const {createRollingPlanner}=await api,edges=[edge('a','b',100),edge('b','t',100)];
  const p=createRollingPlanner({edges,target:'t',getExposure:()=>photo(edges,[.5,.5])});
  const a=p.plan({node:'a'},0),b=p.plan({node:'b'},10,{penalty:8});
  assert.equal(a.search.cacheHit,false);assert.equal(b.search.cacheHit,true);assert.equal(b.cost,450);
  assert.equal(p.stats.preparations,1);assert.equal(p.stats.snapshotLoads,1);
  p.plan({node:'a'},1800);assert.equal(p.stats.preparations,2);assert.equal(p.stats.snapshotLoads,2);
  p.plan({node:'a'},0);assert.equal(p.stats.preparations,3); // no acumula fotos antiguas
  assert.throws(()=>p.plan({node:'a'},0,{maxVisited:1}),{code:'SEARCH_LIMIT'});
  assert.ok(p.plan({node:'a'},0).arrived);
  assert.throws(()=>createRollingPlanner({edges,target:'t',getExposure:()=>[],maxEdges:1}));
});
