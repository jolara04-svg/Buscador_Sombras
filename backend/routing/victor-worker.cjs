// Python/OpenGL y todos los getShadow viven en este unico proceso e hilo.
const fs=require('node:fs');
const path=require('node:path');
const backend=path.resolve(__dirname,'..');
let addon,graphCache;
const graphPaths={local:'graph.json',campus:'campus-graph.json'};
function loadGraph(name){
  if(graphCache?.name!==name)graphCache={name,value:JSON.parse(fs.readFileSync(path.join(backend,'experiments/shadow-routing/data',graphPaths[name]),'utf8'))};
  return graphCache.value;
}
function hasCoverage(lon,lat){
  const n=65536,x=Math.floor((lon+180)/360*n),y=Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n);
  return coverage.get(x)?.has(y)||false;
}
const manifest=require('../madrid_chunks/manifest.json'),coverage=new Map();
for(const [x,ys] of Object.entries(manifest))coverage.set(Number(x),new Set(ys.filter(y=>fs.existsSync(path.join(backend,'madrid_chunks/16',x,`${y}.glb`))).map(Number)));
const service=import('./victor-adapter.mjs').then(({createVictorRouteService})=>createVictorRouteService({loadGraph,hasCoverage,getAddon(){
  if(!addon){const loaded=require('../shaders/lib/binding.js');loaded.initialize();addon=loaded;}
  return addon;
}}));
process.on('message',async message=>{
  try{process.send({id:message.id,result:await (await service).plan(message.input)});}
  catch(error){process.send({id:message.id,error:error.message,status:error.status});}
});
process.on('disconnect',()=>process.exit(0));
