// Diagnostico opcional con el shader real; no modifica grafos ni codigo nativo.
// Desde backend: node routing/check-alternatives.cjs [elevacion=35] [azimut=180] [peso=0.5]
const path=require('node:path');
const fs=require('node:fs');
const {fork}=require('node:child_process');
if(!process.argv.includes('--worker')){
  const child=fork(__filename,[...process.argv.slice(2),'--worker'],{windowsHide:true,stdio:['ignore','ignore','ignore','ipc'],env:{...process.env,PYTHONPATH:[path.join(__dirname,'../shaders/build/runtime-deps'),process.env.PYTHONPATH].filter(Boolean).join(path.delimiter)}});
  const timer=setTimeout(()=>{child.kill();console.error('El shader excedio 120 segundos');process.exitCode=1;},120000);
  child.on('message',message=>{console.log(JSON.stringify(message,null,2));if(message.error)process.exitCode=1;});
  child.on('exit',code=>{clearTimeout(timer);if(code){console.error(`El proceso nativo termino: ${code}`);process.exitCode=1;}});
}else{
  (async()=>{
    const {evaluateVictorExposure}=await import('./victor-adapter.mjs');
    const {createCompactRouter}=await import('../experiments/shadow-routing/compact-routing.mjs');
    const {project,unproject}=await import('../experiments/shadow-routing/core.mjs');
    const campus=process.argv.includes('--campus');
    const graph=JSON.parse(fs.readFileSync(path.join(__dirname,`../experiments/shadow-routing/data/${campus?'campus-graph':'graph'}.json`),'utf8'));
    if(campus){
      const center=project(40.45085,-3.7315,graph.config.center);
      graph.edges=graph.edges.filter(e=>e.geometry.every(p=>Math.hypot(p[0]-center[0],p[1]-center[1])<200));
    }
    const manifest=require('../madrid_chunks/manifest.json');
    const coverage=new Map(Object.entries(manifest).map(([x,ys])=>[Number(x),new Set(ys.filter(y=>fs.existsSync(path.join(__dirname,'../madrid_chunks/16',x,`${y}.glb`))).map(Number))]));
    const covered=(lon,lat)=>coverage.get(Math.floor((lon+180)/360*65536))?.has(Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*65536))||false;
    const args=process.argv.slice(2).filter(a=>!a.startsWith('--'));
    const sun={elevationDeg:Number(args[0]??35),azimuthDeg:Number(args[1]??180)},weight=Number(args[2]??.5);
    const cost=r=>(1-weight)*r.lengthM+weight*r.sunM;
    const addon=require('../shaders/lib/binding.js');addon.initialize();
    const photo=evaluateVictorExposure(graph,sun,(...args)=>addon.getShadow(...args),covered);
    const router=createCompactRouter(graph.edges,photo.exposure),ids=[...new Set(graph.edges.flatMap((e,i)=>photo.exposure[i].cost===null?[]:[e.source,e.target]))];
    const cyclic=[];
    graph.edges.forEach((edge,index)=>{
      if(photo.exposure[index].cost===null)return;
      const seen=new Set([edge.source]),queue=[edge.source];
      for(let k=0;k<queue.length;k++)graph.edges.forEach((e,i)=>{
        if(i===index||photo.exposure[i].cost===null)return;
        const next=e.source===queue[k]?e.target:e.target===queue[k]?e.source:null;
        if(next!==null&&!seen.has(next)){seen.add(next);queue.push(next);}
      });
      if(seen.has(edge.target))cyclic.push({source:edge.source,target:edge.target,...photo.exposure[index]});
    });
    let pairs=0,changed=0,best=null;
    for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++){
      const quick=router.search(ids[a],ids[b],{mode:'distance'}),shade=router.search(ids[a],ids[b],{shadePreference:weight});
      if(!quick||!shade)continue;pairs++;
      if(shade.cost>cost(quick)+1e-6)throw Error('El coste con sombra es peor que el de la rapida');
      if(quick.sunM-shade.sunM>1){changed++;if(!best||quick.sunM-shade.sunM>best.savedSunM){
        const point=id=>unproject(...graph.nodes.find(n=>n.id===id).xy,graph.config.center);
        const stats=r=>({lengthM:r.lengthM,sunM:r.sunM,shadeM:r.shadeM,cost:cost(r)});
        best={source:ids[a],target:ids[b],origin:point(ids[a]),destination:point(ids[b]),savedSunM:quick.sunM-shade.sunM,fastest:stats(quick),shade:stats(shade)};
      }}
    }
    process.send({provider:'victor-native',graph:campus?'campus-radius-200m':'local',sun,shadePreference:weight,calls:photo.calls,unknownEdges:photo.unknownEdges,pairs,changed,best,cycles:{edges:cyclic.length,shadedEdges:cyclic.filter(e=>e.shadeM>1e-6).length},limitations:'Compara solo la zona cubierta seleccionada; angulos de prueba, no una fecha real.'});
  })().catch(error=>{process.send({error:error.message});process.exitCode=1;}).finally(()=>process.disconnect());
}
