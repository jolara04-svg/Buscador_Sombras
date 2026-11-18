import { createCompactRouter } from './compact-routing.mjs';

// Distancia minima RESTANTE en la red dirigida. Un Dijkstra inverso por viaje,
// independiente de la sombra, para impedir avances que luego se deshagan.
export function distanceToDestination(edges, target) {
  const incoming=new Map(), distances=new Map([[target,0]]), heap=[{id:target,cost:0}];
  for(const e of edges){
    if(!(e.lengthM>0)||!Number.isFinite(e.lengthM))throw new Error('Longitud positiva requerida');
    const add=(from,to)=>{if(!incoming.has(to))incoming.set(to,[]);incoming.get(to).push({id:from,cost:e.lengthM});};
    if(e.forward)add(e.source,e.target);if(e.reverse)add(e.target,e.source);
  }
  function push(v){let i=heap.length;heap.push(v);while(i>0){const p=(i-1)>>1;if(heap[p].cost<=v.cost)break;heap[i]=heap[p];i=p;}heap[i]=v;}
  function pop(){const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].cost<heap[c].cost)c++;if(last.cost<=heap[c].cost)break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;}
  while(heap.length){const item=pop();if(item.cost!==distances.get(item.id))continue;for(const arc of incoming.get(item.id)||[]){const cost=item.cost+arc.cost;if(cost<(distances.get(arc.id)??Infinity)){distances.set(arc.id,cost);push({id:arc.id,cost});}}}
  return distances;
}

// Horizonte movil: planifica con la foto ACTUAL, pero ejecuta solo hasta el
// cambio de franja. getExposure(slot) debe suministrar una foto por franja.
export function createRollingPlanner({edges,target,getExposure,intervalSeconds=1800,preventBacktracking=true,maxEdges=500000}) {
  if(!(intervalSeconds>0)||!Number.isFinite(intervalSeconds)||typeof getExposure!=='function')throw new Error('Configuracion temporal invalida');
  if(!Array.isArray(edges)||!Number.isInteger(maxEdges)||maxEdges<1||edges.length>maxEdges)throw new Error('Grafo fuera del presupuesto de aristas');
  const potential=distanceToDestination(edges,target),ids=new Set(edges.flatMap(e=>[e.source,e.target]));
  if(!ids.has(target))throw new Error('Destino inexistente');
  let cachedSlot=null,cachedExposure=null,prepared=null;
  const stats={preparations:0,cacheHits:0,snapshotLoads:0};
  function plan(state,timeSeconds,{speedMps=1.4,penalty=4,mode='shade',maxVisited=250000}={}) {
    if(!Number.isFinite(timeSeconds)||timeSeconds<0||!Number.isFinite(speedMps)||speedMps<=0||!Number.isFinite(penalty)||penalty<1||!['shade','distance'].includes(mode))throw new Error('Parametros de viaje invalidos');
    const slot=Math.floor(timeSeconds/intervalSeconds),nextChange=(slot+1)*intervalSeconds;
    if(cachedSlot!==slot){const snapshot=getExposure(slot);if(!Array.isArray(snapshot)||snapshot.length!==edges.length)throw new Error('Falta la foto de sombra de esta franja');cachedExposure=snapshot;cachedSlot=slot;prepared=null;stats.snapshotLoads++;}
    const exposure=cachedExposure;
    if(state.node===target)return {arrived:true,state,timeSeconds,slot,nextChange,segments:[],lengthM:0,durationSeconds:0};
    let virtual='__rolling_position__';while(ids.has(virtual))virtual+='_';
    let source=state.node,positionEdge=null;
    if(source!==undefined){if(!ids.has(source))throw new Error('Origen inexistente');}
    else {
      positionEdge=edges[state.edgeIndex];
      if(!positionEdge||!(state.fraction>0&&state.fraction<1)||![1,-1].includes(state.direction)||(state.direction===1?!positionEdge.forward:!positionEdge.reverse))throw new Error('Posicion en arista invalida');
      source=virtual;
    }
    const key=positionEdge?`${state.edgeIndex}:${state.fraction}:${state.direction}`:'nodes';
    const cacheHit=prepared?.key===key;
    let graph,weights,mapping,router;
    if(cacheHit){({weights,mapping,router}=prepared);stats.cacheHits++;}
    else {
    graph=[];weights=[];mapping=[];
    function add(originalIndex,from,to,fromFraction,toFraction) {
      const original=edges[originalIndex],e=exposure[originalIndex],fraction=Math.abs(toFraction-fromFraction);
      if(!e||e.cost===null||e.unknownM>1e-7)return;
      if(![e.lengthM,e.shadeM,e.sunM,e.unknownM].every(Number.isFinite)||Math.abs(e.lengthM-original.lengthM)>1e-5||e.shadeM<0||e.sunM<0||e.unknownM<0||Math.abs(e.shadeM+e.sunM-e.lengthM)>1e-5)throw new Error('Foto de exposicion invalida');
      graph.push({source:from,target:to,forward:true,reverse:false});
      weights.push({lengthM:original.lengthM*fraction,shadeM:e.shadeM*fraction,sunM:e.sunM*fraction,unknownM:0,cost:(e.shadeM+penalty*e.sunM)*fraction});
      mapping.push({edgeIndex:originalIndex,from,to,fromFraction,toFraction});
    }
    edges.forEach((e,i)=>{
      const a=potential.get(e.source)??Infinity,b=potential.get(e.target)??Infinity;
      if(e.forward&&(!preventBacktracking||b<a))add(i,e.source,e.target,0,1);
      if(e.reverse&&(!preventBacktracking||a<b))add(i,e.target,e.source,1,0);
    });
    if(positionEdge){
      // Con la salvaguarda, se llega al siguiente cruce sin dar media vuelta
      // en mitad de la misma calle. Sin ella se permiten las dos salidas legales.
      if(positionEdge.forward&&(!preventBacktracking||state.direction===1))add(state.edgeIndex,virtual,positionEdge.target,state.fraction,1);
      if(positionEdge.reverse&&(!preventBacktracking||state.direction===-1))add(state.edgeIndex,virtual,positionEdge.source,state.fraction,0);
    }
    router=createCompactRouter(graph,weights);
    prepared={key,weights,mapping,router};stats.preparations++;
    }
    const route=router.search(source,target,{penalty,mode,maxVisited});
    if(!route)return {arrived:false,unreachable:true,state,timeSeconds,slot,nextChange,segments:[],lengthM:0,durationSeconds:0};
    let budget=(nextChange-timeSeconds)*speedMps,used=0,shadeM=0,sunM=0,endState={...state};
    const segments=[];
    for(const i of route.edgeIndices){
      if(budget<=1e-8)break;
      const m=mapping[i],w=weights[i],travel=Math.min(w.lengthM,budget),ratio=travel/w.lengthM;
      const fraction=m.fromFraction+(m.toFraction-m.fromFraction)*ratio;
      segments.push({...m,toFraction:fraction,lengthM:travel,shadeM:w.shadeM*ratio,sunM:w.sunM*ratio});
      used+=travel;shadeM+=w.shadeM*ratio;sunM+=w.sunM*ratio;budget-=travel;
      endState=ratio>=1-1e-12?{node:m.to}:{edgeIndex:m.edgeIndex,fraction,direction:Math.sign(m.toFraction-m.fromFraction)};
      if(ratio<1-1e-12)break;
    }
    const arrived=endState.node===target;
    return {arrived,unreachable:false,state:endState,timeSeconds:arrived?timeSeconds+used/speedMps:nextChange,slot,nextChange,segments,
      lengthM:used,shadeM,sunM,cost:shadeM+penalty*sunM,durationSeconds:used/speedMps,
      plannedRoute:route.edgeIndices.map(i=>mapping[i]),plannedLengthM:route.lengthM,preventBacktracking,
      search:{visited:route.visited,peakQueue:route.peakQueue,typedArrayBytes:router.stats.typedArrayBytes,cacheHit}};
  }
  return {plan,stats,remainingDistance:node=>potential.get(node)??Infinity};
}
