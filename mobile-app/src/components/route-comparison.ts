import type {CalculatedRoute} from './route-api';

export function routeComparisonText(route: CalculatedRoute): string {
  const c=route.comparison;
  if(!c)return '';
  if(c.reason==='preference-zero')return 'Con preferencia 0 % se elige la menor distancia, sin consultar sombras.';
  if(c.reason==='night')return 'No hay sol en esta franja: ambas opciones buscan la menor distancia.';
  if(c.reason==='coverage-limited')return 'Faltan datos de sombra en la ruta rápida. La alternativa solo utiliza caminos con cobertura; no se puede comparar la exposición completa.';
  if(c.samePath)return 'Las dos opciones coinciden: con este peso y la sombra estimada, ningún desvío mejora el coste. No significa que el recorrido esté en sombra.';
  return `La alternativa evita ${Math.max(0,Math.round(c.savedSunM??0))} m al sol y añade ${Math.max(0,Math.round(c.extraDistanceM))} m de recorrido.`;
}
