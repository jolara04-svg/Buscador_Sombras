const {fork}=require('node:child_process');
const path=require('node:path');

function createNativeRouteClient({timeoutMs=120000,spawn=()=>fork(path.join(__dirname,'victor-worker.cjs'),[],{windowsHide:true,stdio:['ignore','ignore','ignore','ipc'],env:{...process.env,PYTHONPATH:[path.join(__dirname,'../shaders/build/runtime-deps'),process.env.PYTHONPATH].filter(Boolean).join(path.delimiter)}})}={}){
  let child=null,pending=null,seq=0;
  function stop(error){
    const current=child;child=null;if(current)current.kill();
    if(pending){const p=pending;pending=null;clearTimeout(p.timer);p.reject(error);}
  }
  return {plan(input){
    // Sin cola ilimitada ni concurrencia sobre Python/OpenGL.
    if(pending)return Promise.reject(Object.assign(new Error('El motor de rutas esta ocupado; reintenta al terminar'),{status:503}));
    return new Promise((resolve,reject)=>{
      try{
        if(!child){
          const current=child=spawn();
          current.on('message',message=>{if(child!==current||!pending||message.id!==pending.id)return;const p=pending;pending=null;clearTimeout(p.timer);message.error?p.reject(new Error(message.error)):p.resolve(message.result);});
          current.on('error',error=>{if(child===current)stop(error);});
          current.on('exit',(code,signal)=>{if(child===current)stop(new Error(`El modulo nativo termino (${signal||code}); revisa su compilacion y dependencias`));});
        }
        const id=++seq,timer=setTimeout(()=>stop(new Error('El calculo excedio 120 segundos; se ha detenido el proceso nativo')),timeoutMs);
        pending={id,timer,resolve,reject};child.send({id,input});
      }catch(error){stop(error);if(!pending)reject(error);}
    });
  },close(){stop(new Error('Motor de rutas cerrado'));}};
}

function installVictorRoutes(app,{client=createNativeRouteClient()}={}){
  const express=require('express');
  app.post('/api/routes',express.json({limit:'16kb'}),async(req,res)=>{
    try{
      const {validateRouteRequest}=await import('./victor-adapter.mjs');let input;
      try{input=validateRouteRequest(req.body);}catch(error){return res.status(400).json({error:error.message});}
      const result=await client.plan(input);
      return res.status(result.unreachable?422:200).json(result);
    }catch(error){return res.status(error.status||503).json({error:error.message,provider:'victor-native'});}
  });
  return client;
}
module.exports={createNativeRouteClient,installVictorRoutes};
