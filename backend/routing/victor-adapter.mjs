import {unproject} from '../experiments/shadow-routing/core.mjs';
import {createRollingPlanner} from '../experiments/shadow-routing/rolling-routing.mjs';

export function validateRouteRequest(input) {
  const r=input||{},state=r.state||{node:r.source};
  if(!['local','campus'].includes(r.graph||'local')||typeof r.target!=='string'||!r.target||
    !(typeof state.node==='string'&&state.node||Number.isInteger(state.edgeIndex)&&state.edgeIndex>=0&&Number.isFinite(state.fraction)&&state.fraction>0&&state.fraction<1&&[1,-1].includes(state.direction)))throw new Error('Origen, destino o grafo invalidos');
  if(typeof r.at!=='string'||!/(Z|[+-]\d\d:\d\d)$/.test(r.at)||!Number.isFinite(Date.parse(r.at)))throw new Error('at debe ser una fecha ISO con zona horaria');
  const speedMps=r.speedMps??1.4,penalty=r.penalty??4,sun=r.sun;
  if(!Number.isFinite(speedMps)||speedMps<.5||speedMps>2.5||!Number.isFinite(penalty)||penalty<1||penalty>20)throw new Error('Velocidad o penalizacion invalida');
  if(!sun||!Number.isFinite(sun.elevationDeg)||sun.elevationDeg<=0||sun.elevationDeg>90||!Number.isFinite(sun.azimuthDeg)||sun.azimuthDeg<0||sun.azimuthDeg>=360)throw new Error('Se requieren elevacion solar (0,90] y azimut [0,360) en grados');
  return {graph:r.graph||'local',state,target:r.target,at:r.at,speedMps,penalty,sun:{elevationDeg:sun.elevationDeg,azimuthDeg:sun.azimuthDeg}};
}

// Conserva la API nativa: lon1, lat1, lon2, lat2, elev, azim. Su matriz
// usa angulos en radianes desde el eje este; el contrato HTTP usa norte
// y sentido horario, como una brujula. No se cambia el codigo de Victor.
export function victorAngles(sun) {
  return [sun.elevationDeg*Math.PI/180,(90-sun.azimuthDeg)*Math.PI/180];
}

export function evaluateVictorExposure(graph,sun,getShadow,hasCoverage,{maxCalls=200000,stepM=16}={}) {
  if(!Number.isFinite(stepM)||stepM<=0||!Number.isInteger(maxCalls)||maxCalls<1)throw new Error('Presupuesto de muestreo invalido');
  const [elev,azim]=victorAngles(sun);let calls=0;
  const exposure=graph.edges.map(edge=>{
    let shadeM=0,knownM=0,unknownM=0,geometryM=0;
    for(let j=1;j<edge.geometry.length;j++){
      const a=edge.geometry[j-1],b=edge.geometry[j],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(!length)continue;
      geometryM+=length;
      const count=Math.ceil(length/stepM),dl=length/count;
      for(let i=0;i<count;i++){
        const point=t=>unproject(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,graph.config.center);
        const from=point(i/count),to=point((i+1)/count);
        // El addon usa 17 muestras, incluidos extremos. Sin un chunk central
        // en cualquiera de ellas el tramo es desconocido, nunca sol supuesto.
        let covered=true;
        for(let k=0;k<=16;k++){const p=point((i+k/16)/count);if(!hasCoverage(p.lon,p.lat)){covered=false;break;}}
        if(!covered){unknownM+=dl;continue;}
        if(++calls>maxCalls)throw new Error('Presupuesto de consultas al shader excedido');
        const fraction=getShadow(from.lon,from.lat,to.lon,to.lat,elev,azim);
        if(!Number.isFinite(fraction)||fraction<0||fraction>1)throw new Error('El shader devolvio una fraccion de sombra invalida');
        shadeM+=fraction*dl;knownM+=dl;
      }
    }
    if(!Number.isFinite(edge.lengthM)||edge.lengthM<=0||Math.abs(geometryM-edge.lengthM)>1e-5)throw new Error('Longitud y geometria de arista incompatibles');
    const sunM=Math.max(0,knownM-shadeM);
    return {lengthM:edge.lengthM,shadeM,sunM,unknownM,cost:unknownM>1e-7?null:shadeM+4*sunM};
  });
  return {exposure,calls,unknownEdges:exposure.filter(e=>e.cost===null).length};
}

// Una sola foto en memoria. La clave incluye grafo, franja y angulos solares.
export function createVictorRouteService({loadGraph,getAddon,hasCoverage}) {
  let snapshot=null;
  return {async plan(input){
    const r=validateRouteRequest(input),timeSeconds=Date.parse(r.at)/1000;
    const slot=Math.floor(timeSeconds/1800),graph=await loadGraph(r.graph);
    const ids=new Set(graph.nodes.map(n=>n.id));
    if(!ids.has(r.target)||r.state.node!==undefined&&!ids.has(r.state.node)||r.state.edgeIndex!==undefined&&r.state.edgeIndex>=graph.edges.length)throw new Error('Posicion fuera del grafo');
    const key=JSON.stringify([r.graph,slot,r.sun]);
    const cacheHit=snapshot?.key===key;
    if(!cacheHit){
      const addon=await getAddon();
      const value=evaluateVictorExposure(graph,r.sun,(...args)=>addon.getShadow(...args),hasCoverage);
      snapshot={key,...value};
    }
    const planner=createRollingPlanner({edges:graph.edges,target:r.target,getExposure:()=>snapshot.exposure});
    const result=planner.plan(r.state,timeSeconds,{speedMps:r.speedMps,penalty:r.penalty});
    const nodeMap=new Map(graph.nodes.map(n=>[n.id,n]));
    const coordinate=state=>{
      if(state.node!==undefined)return nodeMap.get(state.node).xy;
      const e=graph.edges[state.edgeIndex],a=nodeMap.get(e.source).xy,b=nodeMap.get(e.target).xy;
      return [a[0]+(b[0]-a[0])*state.fraction,a[1]+(b[1]-a[1])*state.fraction];
    };
    const xy=coordinate(result.state);
    return {...result,graph:r.graph,at:r.at,nextRecalculateAt:new Date(result.nextChange*1000).toISOString(),
      reachesStageEndAt:new Date(result.timeSeconds*1000).toISOString(),
      positionAtStageEnd:unproject(xy[0],xy[1],graph.config.center),
      plannedGeometry:(result.plannedRoute||[]).map(s=>{
        const e=graph.edges[s.edgeIndex],a=nodeMap.get(e.source).xy,b=nodeMap.get(e.target).xy;
        return [s.fromFraction,s.toFraction].map(t=>unproject(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,graph.config.center));
      }),
      shadow:{provider:'victor-native',cacheHit,calls:cacheHit?0:snapshot.calls,unknownEdges:snapshot.unknownEdges,
        frameStartsAt:new Date(slot*1800*1000).toISOString(),sun:r.sun,
        limitations:['Solo edificios; vecinos ausentes pueden omitir sombras','17 muestras nativas por subsegmento; fracciones parciales aproximadas','Avance protegido: no garantiza minimo sol global']}};
  }};
}
