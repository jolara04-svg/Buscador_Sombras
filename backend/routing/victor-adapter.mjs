import {project,unproject} from '../experiments/shadow-routing/core.mjs';
import {createRollingPlanner} from '../experiments/shadow-routing/rolling-routing.mjs';
import {createCompactRouter} from '../experiments/shadow-routing/compact-routing.mjs';
import {snapRoutePoints,edgeSection,pointOnEdge} from './snap-points.mjs';

function validateCoordinateRequest(r){
  const valid=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=85&&Math.abs(p.lon)<=180;
  if(!valid(r.origin)||!valid(r.destination))throw new Error('Origen y destino deben contener latitud y longitud validas');
  if(!['local','campus'].includes(r.graph||'campus')||!['fastest','shade'].includes(r.mode||'shade'))throw new Error('Grafo o tipo de ruta invalido');
  if(typeof r.at!=='string'||!/(Z|[+-]\d\d:\d\d)$/.test(r.at)||!Number.isFinite(Date.parse(r.at))||Date.parse(r.at)<0)throw new Error('at debe ser una fecha ISO con zona horaria');
  const speedMps=r.speedMps??1.4,shadePreference=r.shadePreference??.5;
  if(!Number.isFinite(speedMps)||speedMps<.5||speedMps>2.5||!Number.isFinite(shadePreference)||shadePreference<0||shadePreference>1)throw new Error('Velocidad o preferencia de sombra invalida');
  if((r.mode||'shade')==='shade'&&(!r.sun||!Number.isFinite(r.sun.elevationDeg)||Math.abs(r.sun.elevationDeg)>90||!Number.isFinite(r.sun.azimuthDeg)||r.sun.azimuthDeg<0||r.sun.azimuthDeg>=360))throw new Error('Posicion solar invalida');
  return {kind:'coordinates',origin:r.origin,destination:r.destination,graph:r.graph||'campus',mode:r.mode||'shade',at:r.at,sun:r.sun,shadePreference,speedMps};
}

export function validateRouteRequest(input) {
  if(input?.origin!==undefined||input?.destination!==undefined)return validateCoordinateRequest(input);
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
  async function planCoordinates(r){
    const base=await loadGraph(r.graph),snapped=snapRoutePoints(base,r.origin,r.destination),graph=snapped.graph;
    const timeSeconds=Date.parse(r.at)/1000,slot=Math.floor(timeSeconds/1800),nextChange=(slot+1)*1800;
    let exposure,shadow;
    if(r.mode==='fastest'||r.shadePreference===0){
      // Solo longitudes: estos ceros internos no se publican como exposicion.
      exposure=base.edges.map(e=>({lengthM:e.lengthM,shadeM:0,sunM:e.lengthM,unknownM:0,cost:e.lengthM}));
      shadow={provider:'not-evaluated',calls:0,cacheHit:false};
    }else if(r.sun.elevationDeg<=0){
      exposure=base.edges.map(e=>({lengthM:e.lengthM,shadeM:e.lengthM,sunM:0,unknownM:0,cost:0}));
      shadow={provider:'night',calls:0,cacheHit:false};
    }else{
      // Primero busca una cota usando solo cobertura y distancias, sin GPU.
      // Coste <= longitud; si w<1, ninguna mejora puede medir mas de L/(1-w).
      const coverage=evaluateVictorExposure(base,r.sun,()=>0,hasCoverage);
      const splitCoverage=graph.edges.map(e=>{const x=coverage.exposure[e.originalIndex];return {...x,lengthM:e.lengthM,shadeM:0,sunM:e.lengthM,unknownM:x.unknownM*e.lengthFraction};});
      const candidate=snapped.source===snapped.target?{lengthM:0}:createCompactRouter(graph.edges,splitCoverage).search(snapped.source,snapped.target,{mode:'distance',maxVisited:250000});
      if(!candidate)throw Object.assign(new Error('No hay un recorrido con datos de sombra suficientes. Puedes usar la ruta rápida.'),{status:422});
      const bound=r.shadePreference<1?candidate.lengthM/(1-r.shadePreference):Infinity;
      const start=project(snapped.snapped.origin.coordinate.lat,snapped.snapped.origin.coordinate.lon,base.config.center);
      const indices=[];
      base.edges.forEach((e,i)=>{
        const mid=pointOnEdge(e,.5),partial=i===snapped.snapped.origin.index||i===snapped.snapped.destination.index;
        if(coverage.exposure[i].cost!==null&&(partial||e.lengthM<=bound+1e-6)&&Math.hypot(mid[0]-start[0],mid[1]-start[1])<=bound+e.lengthM/2+1e-6)indices.push(i);
      });
      const key=JSON.stringify(['coordinates',r.graph,slot,r.sun,indices]),cacheHit=snapshot?.key===key;
      if(!cacheHit){
        const addon=await getAddon(),value=evaluateVictorExposure({...base,edges:indices.map(i=>base.edges[i])},r.sun,(...args)=>addon.getShadow(...args),hasCoverage);
        const scoped=base.edges.map(e=>({lengthM:e.lengthM,shadeM:0,sunM:0,unknownM:e.lengthM,cost:null}));
        indices.forEach((index,i)=>{scoped[index]=value.exposure[i];});
        snapshot={key,exposure:scoped,calls:value.calls,unknownEdges:coverage.unknownEdges};
      }
      exposure=snapshot.exposure;shadow={provider:'victor-native',calls:cacheHit?0:snapshot.calls,cacheHit,unknownEdges:snapshot.unknownEdges};
    }
    const splitExposure=graph.edges.map(e=>{const original=exposure[e.originalIndex],f=e.lengthFraction;return {lengthM:e.lengthM,shadeM:original.shadeM*f,sunM:original.sunM*f,unknownM:original.unknownM*f,cost:original.cost===null?null:original.cost*f};});
    let route;
    if(snapped.source===snapped.target)route={lengthM:0,shadeM:0,sunM:0,shadeFraction:0,cost:0,edgeIndices:[],visited:0};
    else route=createCompactRouter(graph.edges,splitExposure).search(snapped.source,snapped.target,{mode:r.mode==='fastest'||shadow.provider==='night'||r.shadePreference===0?'distance':'shade',shadePreference:r.shadePreference,maxVisited:250000});
    if(!route)throw Object.assign(new Error(r.mode==='shade'?'No hay un recorrido con datos de sombra suficientes. Puedes usar la ruta rápida.':'No hay un recorrido peatonal conectado entre estos puntos.'),{status:422});
    const geo=xy=>unproject(xy[0],xy[1],base.config.center),geometry=[],stageGeometry=[];
    let remaining=(nextChange-timeSeconds)*r.speedMps,stageM=0,position=snapped.snapped.origin.coordinate;
    for(let k=0;k<route.edgeIndices.length;k++){
      const e=graph.edges[route.edgeIndices[k]],forward=route.nodes[k]===e.source;
      geometry.push(...(forward?e.geometry:[...e.geometry].reverse()).map(geo));
      if(remaining>1e-8){const length=Math.min(e.lengthM,remaining),fraction=length/e.lengthM,from=forward?0:1,to=forward?fraction:1-fraction;stageGeometry.push(...edgeSection(e,from,to).map(geo));position=geo(pointOnEdge(e,to));remaining-=length;stageM+=length;}
    }
    if(!geometry.length)geometry.push(snapped.snapped.origin.coordinate);
    return {mode:r.mode,graph:r.graph,at:r.at,shadePreference:r.shadePreference,lengthM:route.lengthM,durationSeconds:route.lengthM/r.speedMps,
      shadeM:shadow.provider!=='not-evaluated'?route.shadeM:null,sunM:shadow.provider!=='not-evaluated'?route.sunM:null,shadeFraction:shadow.provider!=='not-evaluated'?route.shadeFraction:null,
      cost:r.mode==='fastest'?route.lengthM:(1-r.shadePreference)*route.lengthM+r.shadePreference*route.sunM,geometry,stageGeometry,stageLengthM:stageM,positionAtStageEnd:position,
      nextRecalculateAt:new Date(nextChange*1000).toISOString(),stageEndAt:new Date((timeSeconds+stageM/r.speedMps)*1000).toISOString(),
      snapped:snapped.snapped,shadow:{...shadow,frameStartsAt:new Date(slot*1800*1000).toISOString(),limitations:['Sombra media por tramo; accesos desde los puntos originales no validados','Ruta estimada con la foto solar actual; hay que actualizar en la siguiente franja']}};
  }
  return {async plan(input){
    const r=validateRouteRequest(input);
    if(r.kind==='coordinates')return planCoordinates(r);
    const timeSeconds=Date.parse(r.at)/1000;
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
