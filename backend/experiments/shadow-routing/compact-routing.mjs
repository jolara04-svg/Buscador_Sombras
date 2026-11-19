// CSR + heap indexado: memoria de busqueda O(V), sin entradas duplicadas.
// La topologia y los buffers se preparan una sola vez; no retiene geometrias.
export function createCompactRouter(edges, exposure) {
  const ids=[], index=new Map(), valid=[];
  const node=id=>{if(!index.has(id)){index.set(id,ids.length);ids.push(id);}return index.get(id);};
  const length=new Float64Array(edges.length), shade=new Float64Array(edges.length), sun=new Float64Array(edges.length);
  edges.forEach((edge,i)=>{
    const e=exposure[i];
    if(!e||e.cost===null||e.unknownM>1e-7)return;
    if(![e.lengthM,e.shadeM,e.sunM,e.unknownM].every(Number.isFinite)||e.lengthM<0||e.shadeM<0||e.sunM<0||e.unknownM<0||Math.abs(e.lengthM-e.shadeM-e.sunM)>1e-5*Math.max(1,e.lengthM))throw new Error('Exposicion invalida');
    length[i]=e.lengthM;shade[i]=e.shadeM;sun[i]=e.sunM;
    if(edge.forward||edge.reverse)valid.push({a:node(edge.source),b:node(edge.target),i,forward:edge.forward,reverse:edge.reverse});
  });
  const count=ids.length,offset=new Uint32Array(count+1);
  for(const e of valid){if(e.forward)offset[e.a+1]++;if(e.reverse)offset[e.b+1]++;}
  for(let i=1;i<=count;i++)offset[i]+=offset[i-1];
  const to=new Uint32Array(offset[count]),edgeIndex=new Uint32Array(to.length),cursor=offset.slice();
  const add=(a,b,i)=>{const p=cursor[a]++;to[p]=b;edgeIndex[p]=i;};
  for(const e of valid){if(e.forward)add(e.a,e.b,e.i);if(e.reverse)add(e.b,e.a,e.i);}
  const dist=new Float64Array(count),seen=new Uint32Array(count),closed=new Uint32Array(count),previous=new Uint32Array(count),via=new Uint32Array(count),heap=new Uint32Array(count),position=new Uint32Array(count);
  let generation=0;
  const typedArrayBytes=[length,shade,sun,offset,to,edgeIndex,dist,seen,closed,previous,via,heap,position].reduce((n,a)=>n+a.byteLength,0);
  function search(source,target,{penalty=4,mode='shade',maxVisited=Math.max(1,count)}={}){
    if(!Number.isFinite(penalty)||penalty<1||!['shade','distance'].includes(mode)||!Number.isInteger(maxVisited)||maxVisited<1)throw new Error('Parametros de busqueda invalidos');
    if(!index.has(source)||!index.has(target))return null;
    generation=(generation+1)>>>0;if(generation===0){seen.fill(0);closed.fill(0);generation=1;}
    const start=index.get(source),goal=index.get(target);let size=0,visited=0,peak=0;
    function insertOrDecrease(n){
      let p=position[n];
      if(p>=size||heap[p]!==n){p=size++;heap[p]=n;}
      while(p>0){const parent=(p-1)>>1;if(dist[heap[parent]]<=dist[n])break;heap[p]=heap[parent];position[heap[p]]=p;p=parent;}
      heap[p]=n;position[n]=p;peak=Math.max(peak,size);
    }
    function pop(){const first=heap[0],last=heap[--size];position[first]=count;if(size){let p=0;while(2*p+1<size){let child=2*p+1;if(child+1<size&&dist[heap[child+1]]<dist[heap[child]])child++;if(dist[last]<=dist[heap[child]])break;heap[p]=heap[child];position[heap[p]]=p;p=child;}heap[p]=last;position[last]=p;}return first;}
    seen[start]=generation;dist[start]=0;position[start]=count;insertOrDecrease(start);
    while(size){
      if(visited>=maxVisited){const error=new Error('Limite de nodos explorados alcanzado; no se devuelve una ruta parcial.');error.code='SEARCH_LIMIT';throw error;}
      const current=pop();closed[current]=generation;visited++;
      if(current===goal){const nodes=[ids[goal]],edgeIndices=[];let n=goal;while(n!==start){edgeIndices.push(via[n]);n=previous[n];nodes.push(ids[n]);}nodes.reverse();edgeIndices.reverse();let lengthM=0,shadeM=0,sunM=0;for(const i of edgeIndices){lengthM+=length[i];shadeM+=shade[i];sunM+=sun[i];}return {cost:dist[goal],weightedCost:shadeM+penalty*sunM,lengthM,shadeM,sunM,shadeFraction:lengthM?shadeM/lengthM:0,nodes,edgeIndices,visited,peakQueue:peak};}
      for(let p=offset[current];p<offset[current+1];p++){
        const next=to[p],i=edgeIndex[p];if(closed[next]===generation)continue;
        const candidate=dist[current]+(mode==='distance'?length[i]:shade[i]+penalty*sun[i]);
        if(!Number.isFinite(candidate))throw new Error('Coste fuera del rango numerico');
        if(seen[next]!==generation||candidate<dist[next]){if(seen[next]!==generation){seen[next]=generation;position[next]=count;}dist[next]=candidate;previous[next]=current;via[next]=i;insertOrDecrease(next);}
      }
    }
    return null;
  }
  return {search,stats:{nodes:count,arcs:to.length,typedArrayBytes}};
}
