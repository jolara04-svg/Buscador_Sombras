const canvas=document.getElementById('map'),ctx=canvas.getContext('2d'),$=id=>document.getElementById(id);
const nodeMap=new Map(DATA.graph.nodes.map(n=>[n.id,n]));
const component=new Set(largestComponent(DATA.graph.edges).nodes);
const candidates=DATA.graph.nodes.filter(n=>component.has(n.id));
let source=DATA.example.source,target=DATA.example.target,mode='origin';
// La busqueda no ocupa el hilo de la interfaz. Una consulta activa y solo la
// ultima pendiente: mover el slider no acumula trabajos ni respuestas obsoletas.
const workerCode=`${createCompactRouter.toString()}; let router; onmessage=({data:d})=>{try{if(d.type==='init'){router=createCompactRouter(d.edges,d.exposure);postMessage({type:'ready',stats:router.stats});return;}const t=performance.now();const shortest=router.search(d.source,d.target,{mode:'distance',penalty:d.penalty,maxVisited:d.maxVisited});const shaded=router.search(d.source,d.target,{penalty:d.penalty,maxVisited:d.maxVisited});postMessage({type:'result',id:d.id,source:d.source,target:d.target,shortest,shaded,ms:performance.now()-t,stats:router.stats});}catch(e){postMessage({type:'error',id:d.id,message:e.message});}};`;
const workerUrl=URL.createObjectURL(new Blob([workerCode],{type:'text/javascript'}));
const worker=new Worker(workerUrl);URL.revokeObjectURL(workerUrl);
let ready=false,busy=false,pending=null,requestId=0;
function dispatch(){if(!ready||busy||!pending)return;busy=true;worker.postMessage(pending);pending=null;}
worker.onmessage=({data})=>{if(data.type==='ready'){ready=true;dispatch();return;}busy=false;if(data.id===requestId){if(data.type==='error'){$('insight').textContent=data.message;$('status').textContent='Consulta detenida; reduce la zona o prueba otros puntos.';}else render(data);}dispatch();};
worker.onerror=()=>{busy=false;ready=false;$('insight').textContent='El navegador no pudo ejecutar el worker de rutas. No se ejecuta la busqueda en el hilo de la interfaz.';};
// Solo topologia y exposicion; las geometrias e imagenes no se copian al worker.
worker.postMessage({type:'init',edges:DATA.graph.edges.map(({source,target,forward,reverse})=>({source,target,forward,reverse})),exposure:DATA.exposure});
window.addEventListener('pagehide',()=>worker.terminate(),{once:true});
const background=new Image();background.src=DATA.image;
const pixel=([x,y])=>[(x+256)*2,(256-y)*2];
const fmt=n=>Math.round(n).toLocaleString('es-ES');
function requestRoute(){
  $('factor').textContent='×'+$('penalty').value;
  requestId++;pending={type:'search',id:requestId,source,target,penalty:Number($('penalty').value),maxVisited:Math.min(250000,DATA.graph.nodes.length)};
  $('status').textContent='Calculando en segundo plano…';dispatch();
}
function drawRoute(route,color,width){
  if(!route)return;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';
  for(const i of route.edgeIndices){const g=DATA.graph.edges[i].geometry;ctx.beginPath();g.forEach((p,j)=>ctx[j?'lineTo':'moveTo'](...pixel(p)));ctx.stroke();}
}
let lastResult=null;
function render(result){
  lastResult=result;
  const {shortest,shaded,ms,stats}=result;ctx.fillStyle='#1c2c3c';ctx.fillRect(0,0,1024,1024);if(background.complete&&background.naturalWidth)ctx.drawImage(background,0,0,1024,1024);
  drawRoute(shortest,'#0b243b',14);drawRoute(shortest,'#49b8ff',10);drawRoute(shaded,'#59203e',7);drawRoute(shaded,'#ff64b4',5);
  for(const [id,text]of [[source,'A'],[target,'B']]){const [x,y]=pixel(nodeMap.get(id).xy);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,15,0,Math.PI*2);ctx.fill();ctx.fillStyle='#173d34';ctx.font='bold 18px Segoe UI';ctx.textAlign='center';ctx.fillText(text,x,y+6);}
  ctx.strokeStyle='white';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(45,975);ctx.lineTo(245,975);ctx.stroke();ctx.fillStyle='white';ctx.font='15px Segoe UI';ctx.textAlign='left';ctx.fillText('100 m',45,960);
  $('factor').textContent='×'+$('penalty').value;
  $('cards').innerHTML=[[shortest,'Menor distancia','#2480b5'],[shaded,'Prioridad a la sombra','#b43978']].map(([r,label,color])=>`<article class="card"><h3 style="color:${color}">${label}</h3>${r?`<div class="metrics"><div><strong>${fmt(r.lengthM)}</strong><small>metros totales</small></div><div><strong>${fmt(r.sunM)}</strong><small>metros al sol</small></div><div><strong>${fmt(r.weightedCost)}</strong><small>coste ponderado</small></div></div>`:'Sin conexión dirigida entre estos puntos.'}</article>`).join('');
  $('insight').textContent=!shortest||!shaded?'No existe una ruta para este sentido. Prueba otros puntos.':source===target?'Origen y destino coinciden. Coste cero.':shortest.sunM-shaded.sunM>.01?`${fmt(shortest.sunM-shaded.sunM)} m menos al sol, con ${fmt(shaded.lengthM-shortest.lengthM)} m adicionales.`:'Con estos puntos y esta penalización, ambas rutas tienen la misma exposición al sol.';
  $('status').textContent=`${DATA.graph.nodes.length} nodos · ${DATA.graph.edges.length} tramos. Componente seleccionable: ${candidates.length} nodos. Dos búsquedas: ${ms.toFixed(2)} ms. Buffers de rutas: ${(stats.typedArrayBytes/1048576).toFixed(2)} MiB (sin IDs ni geometrías). A: ${source}. B: ${target}.`;
  window.sample3Result={source,target,shortest,shaded};
}
function selectMode(next){mode=next;$('origin').className=mode==='origin'?'active':'secondary';$('destination').className=mode==='destination'?'active':'secondary';}
$('origin').onclick=()=>selectMode('origin');$('destination').onclick=()=>selectMode('destination');
canvas.onclick=event=>{const r=canvas.getBoundingClientRect(),x=(event.clientX-r.left)/r.width*512-256,y=256-(event.clientY-r.top)/r.height*512;let best=null,dist=Infinity;for(const n of candidates){const d=Math.hypot(n.xy[0]-x,n.xy[1]-y);if(d<dist){dist=d;best=n;}}if(mode==='origin'){source=best.id;selectMode('destination');}else{target=best.id;selectMode('origin');}requestRoute();};
$('penalty').oninput=requestRoute;$('swap').onclick=()=>{[source,target]=[target,source];requestRoute();};$('example').onclick=()=>{source=DATA.example.source;target=DATA.example.target;$('penalty').value=4;selectMode('origin');requestRoute();};
background.onload=()=>{if(lastResult&&lastResult.source===source&&lastResult.target===target)render(lastResult);};background.onerror=()=>{$('insight').textContent='No se pudo cargar el plano incrustado.';};requestRoute();
