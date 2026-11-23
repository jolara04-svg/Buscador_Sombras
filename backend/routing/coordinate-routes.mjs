import {project,unproject} from '../experiments/shadow-routing/core.mjs';
import {createCompactRouter} from '../experiments/shadow-routing/compact-routing.mjs';
import {snapRoutePoints,edgeSection,pointOnEdge} from './snap-points.mjs';
import {evaluateVictorExposure} from './victor-adapter.mjs';

export function validateCoordinateRequest(r){
  const valid=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=85&&Math.abs(p.lon)<=180;
  if(!valid(r.origin)||!valid(r.destination))throw new Error('Origen y destino deben contener latitud y longitud validas');
  if(!['local','campus'].includes(r.graph||'campus')||!['fastest','shade'].includes(r.mode||'shade'))throw new Error('Grafo o tipo de ruta invalido');
  if(typeof r.at!=='string'||!/(Z|[+-]\d\d:\d\d)$/.test(r.at)||!Number.isFinite(Date.parse(r.at))||Date.parse(r.at)<0)throw new Error('at debe ser una fecha ISO con zona horaria');
  const speedMps=r.speedMps??1.4,shadePreference=r.shadePreference??.5;
  if(!Number.isFinite(speedMps)||speedMps<.5||speedMps>2.5||!Number.isFinite(shadePreference)||shadePreference<0||shadePreference>1)throw new Error('Velocidad o preferencia de sombra invalida');
  if((r.mode||'shade')==='shade'&&(!r.sun||!Number.isFinite(r.sun.elevationDeg)||Math.abs(r.sun.elevationDeg)>90||!Number.isFinite(r.sun.azimuthDeg)||r.sun.azimuthDeg<0||r.sun.azimuthDeg>=360))throw new Error('Posicion solar invalida');
  return {kind:'coordinates',origin:r.origin,destination:r.destination,graph:r.graph||'campus',mode:r.mode||'shade',at:r.at,sun:r.sun,shadePreference,speedMps};
}

export function createCoordinateRouteService({loadGraph,getAddon,hasCoverage}) {
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
    let comparison=null;
    if(r.mode==='shade'){
      const distances=graph.edges.map(e=>({lengthM:e.lengthM,shadeM:0,sunM:e.lengthM,unknownM:0,cost:e.lengthM}));
      const quick=snapped.source===snapped.target?{lengthM:0,edgeIndices:[]}:createCompactRouter(graph.edges,distances).search(snapped.source,snapped.target,{mode:'distance',maxVisited:250000});
      const samePath=quick.edgeIndices.length===route.edgeIndices.length&&quick.edgeIndices.every((e,i)=>e===route.edgeIndices[i]);
      const known=shadow.provider!=='not-evaluated'&&quick.edgeIndices.every(i=>splitExposure[i].cost!==null&&splitExposure[i].unknownM<1e-7);
      const sunM=known?quick.edgeIndices.reduce((n,i)=>n+splitExposure[i].sunM,0):null;
      const shadeM=known?quick.lengthM-sunM:null;
      comparison={samePath,reason:shadow.provider==='night'?'night':r.shadePreference===0?'preference-zero':!known?'coverage-limited':samePath?'same-optimum':'different',
        fastest:known?{lengthM:quick.lengthM,sunM,shadeM,shadeFraction:quick.lengthM?shadeM/quick.lengthM:0}:null,
        savedSunM:known?sunM-route.sunM:null,extraDistanceM:route.lengthM-quick.lengthM};
    }
    const geo=xy=>unproject(xy[0],xy[1],base.config.center),geometry=[],stageGeometry=[];
    let remaining=(nextChange-timeSeconds)*r.speedMps,stageM=0,position=snapped.snapped.origin.coordinate;
    for(let k=0;k<route.edgeIndices.length;k++){
      const e=graph.edges[route.edgeIndices[k]],forward=route.nodes[k]===e.source;
      geometry.push(...(forward?e.geometry:[...e.geometry].reverse()).map(geo));
      if(remaining>1e-8){const length=Math.min(e.lengthM,remaining),fraction=length/e.lengthM,from=forward?0:1,to=forward?fraction:1-fraction;stageGeometry.push(...edgeSection(e,from,to).map(geo));position=geo(pointOnEdge(e,to));remaining-=length;stageM+=length;}
    }
    if(!geometry.length)geometry.push(snapped.snapped.origin.coordinate);
    return {mode:r.mode,graph:r.graph,at:r.at,shadePreference:r.shadePreference,comparison,lengthM:route.lengthM,durationSeconds:route.lengthM/r.speedMps,
      shadeM:shadow.provider!=='not-evaluated'?route.shadeM:null,sunM:shadow.provider!=='not-evaluated'?route.sunM:null,shadeFraction:shadow.provider!=='not-evaluated'?route.shadeFraction:null,
      cost:r.mode==='fastest'?route.lengthM:(1-r.shadePreference)*route.lengthM+r.shadePreference*route.sunM,geometry,stageGeometry,stageLengthM:stageM,positionAtStageEnd:position,
      nextRecalculateAt:new Date(nextChange*1000).toISOString(),stageEndAt:new Date((timeSeconds+stageM/r.speedMps)*1000).toISOString(),
      snapped:snapped.snapped,shadow:{...shadow,frameStartsAt:new Date(slot*1800*1000).toISOString(),limitations:['Sombra media por tramo; accesos desde los puntos originales no validados','Ruta estimada con la foto solar actual; hay que actualizar en la siguiente franja']}};
  }
  return {plan: input=>planCoordinates(validateCoordinateRequest(input))};
}
