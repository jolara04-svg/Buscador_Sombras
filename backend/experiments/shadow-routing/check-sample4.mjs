import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const campusMode=process.argv.includes('--campus');
const html=await fs.readFile(new URL(campusMode?'sample5.html':'sample4.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*)<\/script>/)[1],elements=new Map();
const defaults={scenario:campusMode?'campus':'long',strategy:'safe',departure:campusMode?'12:20':'12:00',speed:'1.4',penalty:'4'};
const ctx=new Proxy({}, {get:()=>()=>{},set:()=>true});
let backgroundStrokes=0;
const backgroundContext=new Proxy({}, {get:(_,key)=>key==='stroke'?()=>{backgroundStrokes++;}:()=>{},set:()=>true});
const document={createElement(){return {getContext:()=>backgroundContext};},getElementById(id){if(!elements.has(id))elements.set(id,{value:defaults[id]??'',getContext:()=>ctx});return elements.get(id);}};
const blobs=new Map();let seq=0;
class Blob{constructor(parts){this.code=parts.join('');}}
const urlAPI={createObjectURL(b){const key=String(++seq);blobs.set(key,b.code);return key;},revokeObjectURL(){}};
class Worker{constructor(url){this.scope={performance,postMessage:data=>queueMicrotask(()=>{if(!this.stopped)this.onmessage?.({data});})};vm.createContext(this.scope);vm.runInContext(blobs.get(url),this.scope);}postMessage(data){queueMicrotask(()=>{if(!this.stopped)this.scope.onmessage({data:structuredClone(data)});});}terminate(){this.stopped=true;}}
const window={addEventListener(){}},flush=()=>new Promise(resolve=>setImmediate(resolve));
const app={document,window,Worker,Blob,URL:urlAPI};
vm.runInNewContext(script,app);await flush();
const strokes=backgroundStrokes;app.render();assert.equal(backgroundStrokes,strokes,'La misma franja debe reutilizar el fondo');assert.ok(strokes>0);
if(campusMode){
  assert.ok(window.sample4Result.plan,elements.get('notice').textContent);
  for(let i=0;i<12&&!window.sample4Result.arrived;i++){elements.get('advance').onclick();await flush();}
  assert.ok(window.sample4Result.arrived);assert.ok(window.sample4Result.totalM>7000);assert.ok(window.sample4Result.steps>=3);
  assert.ok(elements.get('context').textContent.includes('41.637'));
  console.log('sample5: grafo campus, worker, proyeccion, cambios de franja y llegada comprobados (contextos simulados).');
  process.exit(0);
}
assert.equal(window.sample4Result.time,43200);assert.equal(window.sample4Result.plan.lengthM,2520);
for(let i=0;i<5&&!window.sample4Result.arrived;i++){elements.get('advance').onclick();await flush();}
assert.ok(window.sample4Result.arrived);assert.ok(Math.abs(window.sample4Result.totalM-6520)<1e-7);
elements.get('strategy').value='naive';elements.get('strategy').onchange();await flush();
for(let i=0;i<4;i++){elements.get('advance').onclick();await flush();}
assert.equal(window.sample4Result.state.node,'a');assert.equal(window.sample4Result.arrived,false);
elements.get('strategy').value='safe';elements.get('scenario').value='ucm';elements.get('scenario').onchange();await flush();
assert.equal(window.sample4Result.time,44400);assert.ok(window.sample4Result.plan,elements.get('notice').textContent);assert.equal(window.sample4Result.plan.nextChange,45000);assert.equal(window.sample4Result.plan.arrived,false);
elements.get('advance').onclick();await flush();assert.equal(window.sample4Result.time,45000);assert.ok(window.sample4Result.state.edgeIndex!==undefined);
for(let i=0;i<10&&!window.sample4Result.arrived;i++){elements.get('advance').onclick();await flush();}
assert.ok(window.sample4Result.arrived);
console.log('sample4: viaje largo, bucle original, llegada protegida, UCM, salida 12:20 y posicion parcial comprobados (workers simulados).');
