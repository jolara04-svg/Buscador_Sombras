// Prueba HTTP real opcional: requiere addon compilado, Python/OpenGL y chunks.
// node routing/check-native.cjs [sourceId targetId]
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {once}=require('node:events');
const express=require('express');
const {installVictorRoutes}=require('./routes.cjs');
(async()=>{
  const app=express(),client=installVictorRoutes(app),server=app.listen(0,'127.0.0.1');
  try{
    await once(server,'listening');
    const request={graph:'local',source:process.argv[2]||'13567249178',target:process.argv[3]||'13567249179',at:'2026-11-22T12:20:00+01:00',sun:{elevationDeg:35,azimuthDeg:180}};
    const results=[];
    for(const penalty of [4,8]){
      const start=performance.now();
      const response=await fetch(`http://127.0.0.1:${server.address().port}/api/routes`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...request,penalty})});
      const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));
      assert.equal(result.shadow.provider,'victor-native');assert.equal(result.arrived,true);
      assert.ok(Math.abs(result.lengthM-result.shadeM-result.sunM)<1e-7);
      results.push({penalty,httpMs:performance.now()-start,...result});
    }
    assert.equal(results[1].shadow.cacheHit,true);assert.equal(results[1].shadow.calls,0);
    const report={generatedAt:new Date().toISOString(),request,results,limitations:['Sol de prueba, no calculado para la fecha','Ruta corta cubierta: no valida cobertura ni rendimiento del campus completo']};
    await fs.writeFile(path.join(__dirname,'../experiments/shadow-routing/output/victor-integration-report.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(results.map(r=>({penalty:r.penalty,httpMs:r.httpMs,lengthM:r.lengthM,shadeM:r.shadeM,sunM:r.sunM,cacheHit:r.shadow.cacheHit,unknownEdges:r.shadow.unknownEdges})),null,2));
  }finally{client.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
