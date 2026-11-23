import {project,unproject} from '../experiments/shadow-routing/core.mjs';

export function pointOnEdge(edge,fraction){
  let remaining=edge.lengthM*fraction;
  for(let i=1;i<edge.geometry.length;i++){
    const a=edge.geometry[i-1],b=edge.geometry[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(remaining<=length||i===edge.geometry.length-1){const t=length?Math.max(0,Math.min(1,remaining/length)):0;return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}
    remaining-=length;
  }
  return edge.geometry[0];
}
export function edgeSection(edge,from,to){
  const low=Math.min(from,to),high=Math.max(from,to),points=[pointOnEdge(edge,low)];let length=0;
  for(let i=1;i<edge.geometry.length-1;i++){const a=edge.geometry[i-1],b=edge.geometry[i];length+=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length>low*edge.lengthM&&length<high*edge.lengthM)points.push(b);}
  points.push(pointOnEdge(edge,high));return from>to?points.reverse():points;
}

// Divide las aristas elegidas, incluidas dos posiciones en la misma calle.
// Conserva sentidos y conexiones OSM: no inventa cruces geometricos.
export function snapRoutePoints(graph,origin,destination,maxDistanceM=100){
  const ids=new Set(graph.nodes.map(n=>n.id)),nodes=[...graph.nodes],cuts=new Map();
  function snap(point,label){
    const xy=project(point.lat,point.lon,graph.config.center);let best=null;
    graph.edges.forEach((edge,index)=>{
      if(!edge.forward&&!edge.reverse)return;let travelled=0;
      for(let i=1;i<edge.geometry.length;i++){
        const a=edge.geometry[i-1],b=edge.geometry[i],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
        if(!length)continue;
        const t=Math.max(0,Math.min(1,((xy[0]-a[0])*dx+(xy[1]-a[1])*dy)/(length*length)));
        const d=Math.hypot(xy[0]-a[0]-dx*t,xy[1]-a[1]-dy*t);
        if(!best||d<best.distanceM)best={index,fraction:(travelled+t*length)/edge.lengthM,distanceM:d};
        travelled+=length;
      }
    });
    if(!best||best.distanceM>maxDistanceM)throw Object.assign(new Error(`${label}: no hay un camino disponible a menos de ${maxDistanceM} m. La zona disponible es Ciudad Universitaria.`),{status:422});
    const edge=graph.edges[best.index];let id;
    if(best.fraction<1e-8)id=edge.source;
    else if(best.fraction>1-1e-8)id=edge.target;
    else{
      if(!cuts.has(best.index))cuts.set(best.index,[]);
      const list=cuts.get(best.index),same=list.find(c=>Math.abs(c.fraction-best.fraction)<1e-8);
      if(same)id=same.id;
      else{id=`__route_${label}__`;while(ids.has(id))id+='_';ids.add(id);list.push({id,fraction:best.fraction});nodes.push({id,xy:pointOnEdge(edge,best.fraction)});}
    }
    const p=pointOnEdge(edge,best.fraction);
    return {...best,node:id,coordinate:unproject(p[0],p[1],graph.config.center)};
  }
  const start=snap(origin,'Origen'),end=snap(destination,'Destino'),edges=[];
  graph.edges.forEach((edge,index)=>{
    const points=[{id:edge.source,fraction:0},...(cuts.get(index)||[]).sort((a,b)=>a.fraction-b.fraction),{id:edge.target,fraction:1}];
    for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];edges.push({...edge,source:a.id,target:b.id,lengthM:edge.lengthM*(b.fraction-a.fraction),geometry:edgeSection(edge,a.fraction,b.fraction),originalIndex:index,lengthFraction:b.fraction-a.fraction});}
  });
  return {graph:{...graph,nodes,edges},source:start.node,target:end.node,snapped:{origin:start,destination:end}};
}
