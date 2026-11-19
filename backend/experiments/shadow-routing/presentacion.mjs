import { makeAdjacency, dijkstra, summarizeRoute } from './routing.mjs';

export const places = [
  {id:'a',name:'Plaza de salida',x:90,y:250}, {id:'b',name:'Cruce del mercado',x:290,y:250},
  {id:'c',name:'Biblioteca',x:510,y:250}, {id:'d',name:'Estación',x:710,y:250},
  {id:'e',name:'Jardín oeste',x:200,y:100}, {id:'f',name:'Paseo de los árboles',x:410,y:90},
  {id:'g',name:'Parque este',x:620,y:100}, {id:'h',name:'Café de la plaza',x:290,y:390},
  {id:'i',name:'Centro cultural',x:510,y:390}
];
const links = [['a','b',.05],['b','c',.1],['c','d',.05],['a','e',.85],['e','f',1],['f','g',.95],['g','d',.85],['b','f',.5],['c','g',.5],['a','h',.3],['h','i',.65],['i','d',.3],['b','h',.15],['c','i',.15]];
export const edges = links.map(([source,target,shade],i)=>{
  const a=places.find(p=>p.id===source),b=places.find(p=>p.id===target);
  return {id:String(i),source,target,forward:true,reverse:true,lengthM:Math.hypot(a.x-b.x,a.y-b.y),shade};
});
export function compare(source,target,penalty){
  const exposure=edges.map(e=>({lengthM:e.lengthM,shadeM:e.lengthM*e.shade,sunM:e.lengthM*(1-e.shade),unknownM:0,cost:e.lengthM*(e.shade+penalty*(1-e.shade))}));
  const search=mode=>summarizeRoute(dijkstra(makeAdjacency(edges,exposure,mode),source,target),exposure);
  return {shortest:search('distance'),shaded:search('shade')};
}
if(typeof document!=='undefined'){
  const $=id=>document.getElementById(id),fmt=n=>Math.round(n).toLocaleString('es-ES');
  for(const id of ['start','end']) for(const p of places){const o=document.createElement('option');o.value=p.id;o.textContent=p.name;$(id).append(o);}
  $('end').value='d';
  const pos=id=>places.find(p=>p.id===id);
  function update(){
    const penalty=Number($('penalty').value),{shortest,shaded}=compare($('start').value,$('end').value,penalty);
    $('factor').textContent=`×${penalty}`;$('factorText').textContent=penalty;
    const trees=[[140,55],[280,57],[340,130],[475,45],[560,145],[690,65],[70,370],[610,410]];
    let drawing='<rect width="800" height="480" fill="#edf0e5"/><path d="M0 25 Q350 190 800 20 L800 160 Q400 220 0 140Z" fill="#dde8cf"/>';
    drawing+=trees.map(([x,y])=>`<circle cx="${x+4}" cy="${y+5}" r="21" fill="#c8d9bc"/><circle cx="${x}" cy="${y}" r="17" fill="#aec99f"/>`).join('');
    drawing+=[[325,295,120,50],[345,165,95,40],[75,145,75,45],[580,310,100,48]].map(([x,y,w,h])=>`<rect x="${x+7}" y="${y+7}" width="${w}" height="${h}" rx="6" fill="#d2d9cb"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#e1e5dc" stroke="#cad3c4"/>`).join('');
    for(const e of edges){const a=pos(e.source),b=pos(e.target);drawing+=`<path d="M${a.x} ${a.y}L${b.x} ${b.y}" fill="none" stroke="white" stroke-width="20" stroke-linecap="round"/><path d="M${a.x} ${a.y}L${a.x+(b.x-a.x)*e.shade} ${a.y+(b.y-a.y)*e.shade}" stroke="#aec8a0" stroke-width="14" stroke-linecap="round"/>`;}
    for(const [route,color,width] of [[shortest,'#3285bd',9],[shaded,'#227854',4]]){drawing+=`<path class="route" d="${route.nodes.map((id,i)=>`${i?'L':'M'}${pos(id).x} ${pos(id).y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;}
    for(const p of places){const label=p.id===$('start').value?'A':p.id===$('end').value?'B':'';drawing+=`<circle cx="${p.x}" cy="${p.y}" r="${label?16:5}" fill="${label?'#173d34':'white'}" stroke="#173d34" stroke-width="2"/>${label?`<text x="${p.x}" y="${p.y+5}" text-anchor="middle" font-size="13" fill="white" font-weight="700">${label}</text>`:''}<text x="${p.x}" y="${p.y+35}" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="12" fill="#526b58">${p.name}</text>`;}
    drawing+='<text x="755" y="40" text-anchor="middle" fill="#73836d" font-size="12">N ↑</text>';$('map').innerHTML=drawing;
    $('stats').innerHTML=[[shortest,'Menor distancia',''],[shaded,'Prioridad a la sombra','shaded']].map(([r,title,cls])=>`<article class="card ${cls}"><h3>${title}</h3><div class="metrics"><div><strong>${fmt(r.lengthM)}</strong><small>metros de paseo</small></div><div><strong>${fmt(r.sunM)}</strong><small>metros al sol</small></div><div><strong>${fmt(r.weightedCost)}</strong><small>coste ponderado</small></div></div></article>`).join('');
    const saved=shortest.sunM-shaded.sunM,extra=shaded.lengthM-shortest.lengthM;
    $('insight').textContent=shortest.lengthM===0?'El origen y el destino coinciden. El coste es cero.':saved>.01?`${fmt(saved)} m menos al sol por ${fmt(extra)} m adicionales de paseo.`:'Con esta preferencia, ambas búsquedas eligen el mismo recorrido.';
    $('steps').textContent=`Dijkstra · ${places.length} nodos · ${edges.length} tramos · ${shaded.visited} nodos explorados en la búsqueda con sombra`;
  }
  for(const id of ['start','end','penalty'])$(id).addEventListener('input',update);
  $('replay').addEventListener('click',update);update();
}
