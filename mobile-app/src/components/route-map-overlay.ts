import type {MapRoutes,RoutePoint,CalculatedRoute,RouteMode} from './route-api';

// Script compartido entre iframe y WebView; solo se incrustan numeros validos.
export function routeOverlayScript(routes?: MapRoutes|null,origin?: RoutePoint|null,destination?: RoutePoint|null): string {
  if (!routes) return '';
  const valid=(points: RoutePoint[])=>points.length>1&&points.every(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180);
  const data: {mode: RouteMode; route: CalculatedRoute; color: string; label: string}[]=[];
  if(routes.fastest&&valid(routes.fastest.geometry))data.push({mode:'fastest',route:routes.fastest,color:'#1677b7',label:'Más rápida'});
  if(routes.shaded&&valid(routes.shaded.geometry))data.push({mode:'shade',route:routes.shaded,color:'#258443',label:'Prioridad a la sombra'});
  data.sort((a,b)=>Number(a.mode===routes.selected)-Number(b.mode===routes.selected));
  const connector=(points: RoutePoint[])=>valid(points)?`L.polyline(${JSON.stringify(points.map(p=>[p.lat,p.lon]))},{color:'#777',dashArray:'5 5',weight:2}).addTo(map);`:'';
  const primary=routes.selected==='shade'?routes.shaded:routes.fastest;
  return data.map(({mode,route,color,label})=>`
    var routeLine=L.polyline(${JSON.stringify(route.geometry.map(p=>[p.lat,p.lon]))}, {color:'${color}',weight:${mode===routes.selected?6:3},opacity:${mode===routes.selected?1:.65}}).addTo(map).bindTooltip('${label}');
    ${mode===routes.selected?'map.fitBounds(routeLine.getBounds(),{padding:[45,45],maxZoom:17,animate:false});':''}
  `).join('')+(primary&&origin&&destination?connector([origin,primary.snapped.origin.coordinate])+connector([primary.snapped.destination.coordinate,destination]):'');
}
