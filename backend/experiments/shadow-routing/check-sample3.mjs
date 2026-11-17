import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=await fs.readFile(new URL('sample3.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*)<\/script>/)[1];
const elements=new Map();
const ctx=new Proxy({}, {get:(_,key)=>()=>{},set:()=>true});
const document={getElementById(id){if(!elements.has(id))elements.set(id,{value:id==='penalty'?'4':'',getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0,width:680,height:680})});return elements.get(id);}};
class Image{complete=true;naturalWidth=1024;}
const window={addEventListener(){}};
const blobs=new Map();let workerCount=0;
class Blob{constructor(parts){this.code=parts.join('');}}
const workerURL={createObjectURL(blob){blobs.set('worker',blob.code);return 'worker';},revokeObjectURL(){}};
class Worker{
  constructor(url){workerCount++;this.scope={performance,postMessage:data=>queueMicrotask(()=>this.onmessage?.({data}))};vm.createContext(this.scope);vm.runInContext(blobs.get(url),this.scope);}
  postMessage(data){queueMicrotask(()=>this.scope.onmessage({data:structuredClone(data)}));}
  terminate(){}
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
vm.runInNewContext(script,{document,window,Image,performance,Worker,Blob,URL:workerURL});
await flush();
assert.ok(window.sample3Result.shaded.sunM<window.sample3Result.shortest.sunM);
assert.ok(elements.get('cards').innerHTML.includes('Menor distancia'));
for(const value of [1,2,4,8]){elements.get('penalty').value=String(value);elements.get('penalty').oninput();await flush();const r=window.sample3Result;assert.ok(r.shaded.weightedCost<=r.shortest.weightedCost+1e-7);}
const before=window.sample3Result;elements.get('swap').onclick();await flush();assert.equal(window.sample3Result.source,before.target);
elements.get('example').onclick();await flush();
for(const [x,y]of [[100,100],[500,500],[300,350],[600,50]]){elements.get('map').onclick({clientX:x,clientY:y});await flush();const r=window.sample3Result;if(r.shortest&&r.shaded)assert.ok(r.shaded.weightedCost<=r.shortest.weightedCost+1e-7);}
for(let i=0;i<100;i++){elements.get('penalty').value=String(1+i%8);elements.get('penalty').oninput();}
await flush();assert.equal(workerCount,1);assert.ok(window.sample3Result.shaded.weightedCost<=window.sample3Result.shortest.weightedCost+1e-7);
console.log('sample3: script autonomo valido; render, penalizaciones, intercambio, restauracion y seleccion de puntos comprobados.');
