const canvas=document.getElementById('map'),ctx=canvas.getContext('2d'),$=id=>document.getElementById(id);
const nodeMap=new Map(DATA.graph.nodes.map(n=>[n.id,n]));
const component=new Set(largestComponent(DATA.graph.edges).nodes);
const candidates=DATA.graph.nodes.filter(n=>component.has(n.id));
let source=DATA.example.source,target=DATA.example.target,mode='origin';
const background=new Image();background.src=DATA.image;
const pixel=([x,y])=>[(x+256)*2,(256-y)*2];
const fmt=n=>Math.round(n).toLocaleString('es-ES');
function routeData(){
  const exposure=DATA.exposure.map(e=>({...e,cost:e.shadeM+Number($('penalty').value)*e.sunM}));
  const time=performance.now();
  const shortest=summarizeRoute(dijkstra(makeAdjacency(DATA.graph.edges,exposure,'distance'),source,target),exposure);
  const shaded=summarizeRoute(dijkstra(makeAdjacency(DATA.graph.edges,exposure),source,target),exposure);
  return {shortest,shaded,ms:performance.now()-time};
}
function drawRoute(route,color,width){
  if(!route)return;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';
  for(const i of route.edgeIndices){const g=DATA.graph.edges[i].geometry;ctx.beginPath();g.forEach((p,j)=>ctx[j?'lineTo':'moveTo'](...pixel(p)));ctx.stroke();}
}
function render(){
  const {shortest,shaded,ms}=routeData();ctx.fillStyle='#1c2c3c';ctx.fillRect(0,0,1024,1024);if(background.complete&&background.naturalWidth)ctx.drawImage(background,0,0,1024,1024);
  drawRoute(shortest,'#0b243b',14);drawRoute(shortest,'#49b8ff',10);drawRoute(shaded,'#59203e',7);drawRoute(shaded,'#ff64b4',5);
  for(const [id,text]of [[source,'A'],[target,'B']]){const [x,y]=pixel(nodeMap.get(id).xy);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,15,0,Math.PI*2);ctx.fill();ctx.fillStyle='#173d34';ctx.font='bold 18px Segoe UI';ctx.textAlign='center';ctx.fillText(text,x,y+6);}
  ctx.strokeStyle='white';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(45,975);ctx.lineTo(245,975);ctx.stroke();ctx.fillStyle='white';ctx.font='15px Segoe UI';ctx.textAlign='left';ctx.fillText('100 m',45,960);
  $('factor').textContent='×'+$('penalty').value;
  $('cards').innerHTML=[[shortest,'Menor distancia','#2480b5'],[shaded,'Prioridad a la sombra','#b43978']].map(([r,label,color])=>`<article class="card"><h3 style="color:${color}">${label}</h3>${r?`<div class="metrics"><div><strong>${fmt(r.lengthM)}</strong><small>metros totales</small></div><div><strong>${fmt(r.sunM)}</strong><small>metros al sol</small></div><div><strong>${fmt(r.weightedCost)}</strong><small>coste ponderado</small></div></div>`:'Sin conexión dirigida entre estos puntos.'}</article>`).join('');
  $('insight').textContent=!shortest||!shaded?'No existe una ruta para este sentido. Prueba otros puntos.':source===target?'Origen y destino coinciden. Coste cero.':shortest.sunM-shaded.sunM>.01?`${fmt(shortest.sunM-shaded.sunM)} m menos al sol, con ${fmt(shaded.lengthM-shortest.lengthM)} m adicionales.`:'Con estos puntos y esta penalización, ambas rutas tienen la misma exposición al sol.';
  $('status').textContent=`${DATA.graph.nodes.length} nodos · ${DATA.graph.edges.length} tramos. Componente seleccionable: ${candidates.length} nodos. Dos búsquedas y preparación: ${ms.toFixed(2)} ms. A: ${source}. B: ${target}.`;
  window.sample3Result={source,target,shortest,shaded};
}
function selectMode(next){mode=next;$('origin').className=mode==='origin'?'active':'secondary';$('destination').className=mode==='destination'?'active':'secondary';}
$('origin').onclick=()=>selectMode('origin');$('destination').onclick=()=>selectMode('destination');
canvas.onclick=event=>{const r=canvas.getBoundingClientRect(),x=(event.clientX-r.left)/r.width*512-256,y=256-(event.clientY-r.top)/r.height*512;let best=null,dist=Infinity;for(const n of candidates){const d=Math.hypot(n.xy[0]-x,n.xy[1]-y);if(d<dist){dist=d;best=n;}}if(mode==='origin'){source=best.id;selectMode('destination');}else{target=best.id;selectMode('origin');}render();};
$('penalty').oninput=render;$('swap').onclick=()=>{[source,target]=[target,source];render();};$('example').onclick=()=>{source=DATA.example.source;target=DATA.example.target;$('penalty').value=4;selectMode('origin');render();};
background.onload=render;background.onerror=()=>{$('insight').textContent='No se pudo cargar el plano incrustado.';};render();
