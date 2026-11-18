const $=id=>document.getElementById(id),canvas=$('map'),ctx=canvas.getContext('2d');
const longGraph={nodes:[{id:'a',xy:[-250,0]},{id:'b',xy:[-50,0]},{id:'c',xy:[-180,170]},{id:'t',xy:[250,50]}],edges:[{source:'a',target:'b',lengthM:2520},{source:'b',target:'t',lengthM:4000},{source:'a',target:'c',lengthM:3000},{source:'c',target:'t',lengthM:3000}].map(e=>({...e,forward:true,reverse:true})),source:'a',target:'t'};
let graph,state,time,departure,totalM=0,totalSun=0,steps=0,history=[],plan=null,worker=null,version=0,busy=false;
const clock=seconds=>`${String(Math.floor(seconds/3600)%24).padStart(2,'0')}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}`;
const fmt=n=>Math.round(n).toLocaleString('es-ES');
function fractions(slot){return $('scenario').value==='long'?(slot%2?[1,0,1,1]:[1,1,0,0]):UCM.exposure.map(e=>slot%2?1-e.shadeM/e.lengthM:e.shadeM/e.lengthM);}
function node(id){return graph.nodes.find(n=>n.id===id);}
function xy(position){if(position.node!==undefined)return node(position.node).xy;const e=graph.edges[position.edgeIndex],a=node(e.source).xy,b=node(e.target).xy;return [a[0]+(b[0]-a[0])*position.fraction,a[1]+(b[1]-a[1])*position.fraction];}
function point(edgeIndex,fraction){const e=graph.edges[edgeIndex],a=node(e.source).xy,b=node(e.target).xy;return [a[0]+(b[0]-a[0])*fraction,a[1]+(b[1]-a[1])*fraction];}
const px=([x,y])=>[(x+300)*1.65+45,650-(y+260)*1.08];
function line(a,b,color,width,dash=[]){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(...px(a));ctx.lineTo(...px(b));ctx.stroke();ctx.setLineDash([]);}
function draw(){
  ctx.fillStyle='#192b36';ctx.fillRect(0,0,1080,800);ctx.lineCap='round';const f=fractions(Math.floor(time/1800));
  graph.edges.forEach((e,i)=>{const geometry=e.geometry||[node(e.source).xy,node(e.target).xy];for(let j=1;j<geometry.length;j++)line(geometry[j-1],geometry[j],`rgb(${Math.round(237-176*f[i])},${Math.round(135+52*f[i])},95)`,3);});
  if(plan?.plannedRoute)for(const s of plan.plannedRoute)line(point(s.edgeIndex,s.fromFraction),point(s.edgeIndex,s.toFraction),'#e8c8df',4,[8,9]);
  for(const h of history)for(const s of h.segments)line(point(s.edgeIndex,s.fromFraction),point(s.edgeIndex,s.toFraction),'#41c394',7);
  if(plan)for(const s of plan.segments)line(point(s.edgeIndex,s.fromFraction),point(s.edgeIndex,s.toFraction),'#ff69bd',5);
  for(const [position,label]of [[{node:graph.source},'A'],[{node:graph.target},'Destino'],[state,'Tú']]){const [x,y]=px(xy(position));ctx.fillStyle=label==='Tú'?'#fff':'#a4cbb8';ctx.beginPath();ctx.arc(x,y,label==='Tú'?10:7,0,Math.PI*2);ctx.fill();ctx.font='bold 17px Segoe UI';ctx.fillText(label,x+14,y-12);}
  ctx.font='16px Segoe UI';ctx.fillStyle='#d8e5df';ctx.fillText($('scenario').value==='long'?'Esquema de prueba · longitudes indicadas en la simulación':'Caminos reales UCM · exposición temporal de prueba',28,40);
  if($('scenario').value==='long'){for(const n of graph.nodes){const [x,y]=px(n.xy);ctx.fillText(n.id.toUpperCase(),x-15,y+30);}}
}
function render(){
  draw();$('metrics').innerHTML=`<div><strong>${clock(time)}</strong><small>hora actual</small></div><div><strong>${fmt(totalM)} m</strong><small>recorridos</small></div><div><strong>${fmt(totalSun)} m</strong><small>al sol acumulados</small></div><div><strong>${fmt((time-departure)/60)} min</strong><small>andando</small></div>`;
  $('history').innerHTML='<b>Etapas del paseo</b>'+history.map(h=>`<p>${clock(h.start)} → ${clock(h.timeSeconds)} · ${fmt(h.lengthM)} m · ${fmt(h.sunM||0)} m al sol · ${h.state.node?'nodo '+h.state.node:'a mitad de una calle'}</p>`).join('');
  $('advance').disabled=busy||!plan||plan.unreachable||state.node===graph.target||steps>=12;
  $('advance').textContent=busy?'Calculando…':!plan?'Sin ruta':state.node===graph.target?'Has llegado':plan.arrived?`Caminar hasta llegar · ${clock(plan.timeSeconds)}`:`Caminar hasta ${clock(plan.nextChange)} y recalcular`;
  $('notice').textContent=state.node===graph.target?'Has llegado. El paseo termina sin esperar al próximo cambio.':steps>=12?'Prueba detenida tras doce cambios. Revisa si la estrategia está repitiendo el recorrido.':plan?.unreachable?'No hay ruta permitida con esta cobertura y esta estrategia.':plan?`Próxima etapa: ${fmt(plan.lengthM)} m en ${((plan.timeSeconds-time)/60).toFixed(1)} min. Ruta prevista restante: ${fmt(plan.plannedLengthM)} m.`:'Preparando ruta…';
  window.sample4Result={state,time,totalM,totalSun,steps,plan,arrived:state.node===graph.target};
}
function calculate(){busy=true;plan=null;render();worker.postMessage({state,time,speed:Number($('speed').value),penalty:Number($('penalty').value)});}
function reset(){
  version++;worker?.terminate();const current=version;
  graph=$('scenario').value==='long'?longGraph:{...UCM.graph,source:UCM.example.source,target:UCM.example.target};
  const parts=$('departure').value.split(':').map(Number),speed=Number($('speed').value);
  if(parts.length!==2||!parts.every(Number.isFinite)||!Number.isFinite(speed)||speed<.5||speed>2.5){$('notice').textContent='Introduce una hora y una velocidad entre 0,5 y 2,5 m/s.';return;}
  departure=parts[0]*3600+parts[1]*60;time=departure;state={node:graph.source};totalM=0;totalSun=0;steps=0;history=[];plan=null;
  const config={edges:graph.edges,target:graph.target,preventBacktracking:$('strategy').value==='safe',long:$('scenario').value==='long',base:UCM.exposure};
  const code=`${createCompactRouter.toString()};${distanceToDestination.toString()};${createRollingPlanner.toString()};const config=${JSON.stringify(config)};const getExposure=slot=>config.edges.map((e,i)=>{const f=config.long?(slot%2?[1,0,1,1]:[1,1,0,0])[i]:(slot%2?1-config.base[i].shadeM/e.lengthM:config.base[i].shadeM/e.lengthM);return {lengthM:e.lengthM,shadeM:e.lengthM*f,sunM:e.lengthM*(1-f),unknownM:0,cost:e.lengthM*(4-3*f)};});const planner=createRollingPlanner({...config,getExposure});onmessage=({data:d})=>{try{postMessage({result:planner.plan(d.state,d.time,{speedMps:d.speed,penalty:d.penalty})});}catch(e){postMessage({error:e.message});}};`;
  const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));worker=new Worker(url);URL.revokeObjectURL(url);
  worker.onmessage=({data})=>{if(current!==version)return;busy=false;if(data.error){plan=null;render();$('notice').textContent=data.error;return;}plan=data.result;render();};
  worker.onerror=()=>{if(current!==version)return;busy=false;plan=null;render();$('notice').textContent='El navegador no pudo ejecutar la simulación en segundo plano.';};
  $('context').textContent=$('scenario').value==='long'?'Red controlada: la sombra alterna cada media hora. El dibujo es un esquema, no un mapa a escala.':'Grafo UCM real; exposición futura simulada. Sal a las 12:20 para cruzar un cambio durante este paseo corto.';
  calculate();
}
$('advance').onclick=()=>{if(busy||!plan||plan.unreachable||steps>=12||state.node===graph.target)return;history.push({...plan,start:time});totalM+=plan.lengthM;totalSun+=plan.sunM||0;state=plan.state;time=plan.timeSeconds;steps++;if(plan.arrived){plan=null;render();}else calculate();};
$('reset').onclick=reset;for(const id of ['scenario','strategy','departure','speed','penalty'])$(id).onchange=()=>{if(id==='scenario')$('departure').value=$('scenario').value==='ucm'?'12:20':'12:00';reset();};
window.addEventListener('pagehide',()=>worker?.terminate(),{once:true});reset();
