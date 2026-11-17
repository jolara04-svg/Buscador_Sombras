import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=await fs.readFile(new URL('sample3.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*)<\/script>/)[1];
const elements=new Map();
const ctx=new Proxy({}, {get:(_,key)=>()=>{},set:()=>true});
const document={getElementById(id){if(!elements.has(id))elements.set(id,{value:id==='penalty'?'4':'',getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0,width:680,height:680})});return elements.get(id);}};
class Image{complete=true;naturalWidth=1024;}
const window={};
vm.runInNewContext(script,{document,window,Image,performance});
assert.ok(window.sample3Result.shaded.sunM<window.sample3Result.shortest.sunM);
assert.ok(elements.get('cards').innerHTML.includes('Menor distancia'));
for(const value of [1,2,4,8]){elements.get('penalty').value=String(value);elements.get('penalty').oninput();const r=window.sample3Result;assert.ok(r.shaded.weightedCost<=r.shortest.weightedCost+1e-7);}
const before=window.sample3Result;elements.get('swap').onclick();assert.equal(window.sample3Result.source,before.target);
elements.get('example').onclick();
for(const [x,y]of [[100,100],[500,500],[300,350],[600,50]]){elements.get('map').onclick({clientX:x,clientY:y});const r=window.sample3Result;if(r.shortest&&r.shaded)assert.ok(r.shaded.weightedCost<=r.shortest.weightedCost+1e-7);}
console.log('sample3: script autonomo valido; render, penalizaciones, intercambio, restauracion y seleccion de puntos comprobados.');
