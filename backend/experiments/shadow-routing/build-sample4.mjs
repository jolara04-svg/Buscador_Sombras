import fs from 'node:fs/promises';
const read=name=>fs.readFile(new URL(name,import.meta.url),'utf8');
const graph=JSON.parse(await read('data/graph.json')),report=JSON.parse(await read('output/report.json'));
const byId=new Map(report.edges.map(e=>[e.id,e]));
const data={graph,exposure:graph.edges.map(e=>{const p=byId.get(e.id);if(!p||Math.abs(p.lengthM-e.lengthM)>1e-6)throw new Error('Datos incompatibles');const shadeM=Math.max(0,Math.min(e.lengthM,p.shadeM));return {...p,shadeM,sunM:e.lengthM-shadeM};}),example:{source:'13567263103',target:'9847636020'}};
const compact=(await read('compact-routing.mjs')).replaceAll('export function','function');
const rolling=(await read('rolling-routing.mjs')).replace(/^import[^\n]+\n/,'').replaceAll('export function','function');
const ui=await read('sample4-ui.js');
const campus=process.argv.includes('--campus');let extra='',template=await read('sample4-template.html');
if(campus){
  const g=JSON.parse(await read('data/campus-graph.json')),report=JSON.parse(await read('output/campus-report.json'));
  // La demo no necesita etiquetas, lat/lon ni metadatos por arista. Conserva
  // toda la topologia y geometria, sin duplicar el JSON de descarga completo.
  const graph={config:g.config,nodes:g.nodes.map(({id,xy})=>({id,xy})),edges:g.edges.map(({source,target,lengthM,geometry,forward,reverse})=>({source,target,lengthM,geometry,forward,reverse}))};
  extra=`const CAMPUS=${JSON.stringify({graph,example:report.example})};\n${(await read('campus-exposure.mjs')).replaceAll('export function','function')}`;
  template=template.replace('Sample 4','Sample 5').replace('SombrApp · Paseos por intervalos','SombrApp · Ciudad Universitaria').replace('<option value="long">','<option value="campus" selected>Ciudad Universitaria · 4,1 × 4,1 km</option><option value="long">').replace('value="12:00"','value="12:20"').replace('Tú avanzas. La ruta se actualiza.','Un paseo por Ciudad Universitaria.').replace('<summary>Qué demuestra y qué se supone</summary>','<summary>Qué demuestra y qué se supone</summary><p>Campus: 36.490 nodos y 41.637 tramos reales OSM en una caja de 4,1 × 4,1 km. Incluye el recinto principal y su entorno; no es un límite administrativo ni incluye campus separados. Todas las sombras de este escenario son sintéticas. No se cargan modelos 3D.</p>');
}
const script=`const UCM=${JSON.stringify(data)};\n${compact}\n${rolling}\n${extra}\n${ui}`;
const name=campus?'sample5.html':'sample4.html';
await fs.writeFile(new URL(name,import.meta.url),template.replace('/* SAMPLE4_SCRIPT */',()=>script.replaceAll('</script','<\\/script')));
console.log(`${name} generado: motor temporal y datos incrustados, sin servidor.`);
