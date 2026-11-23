import {calculateSunPosition} from './point-shadow-query';

export type RoutePoint = {lat: number; lon: number};
export type RouteMode = 'fastest' | 'shade';
export type CalculatedRoute = {
  mode: RouteMode;
  lengthM: number;
  durationSeconds: number;
  shadeM: number | null;
  sunM: number | null;
  shadeFraction: number | null;
  geometry: RoutePoint[];
  stageGeometry: RoutePoint[];
  nextRecalculateAt: string;
  snapped: {origin: {coordinate: RoutePoint; distanceM: number}; destination: {coordinate: RoutePoint; distanceM: number}};
  shadow: {provider: string; frameStartsAt: string};
  comparison?: {samePath: boolean; reason: 'night'|'preference-zero'|'coverage-limited'|'same-optimum'|'different';
    fastest: {lengthM: number;sunM: number;shadeM: number;shadeFraction: number}|null; savedSunM: number|null;extraDistanceM: number}|null;
};
export type MapRoutes = {contextKey: string; fastest: CalculatedRoute | null; shaded: CalculatedRoute | null; selected: RouteMode};
export const DEFAULT_SHADE_PREFERENCE = 0.5;

export function buildRouteRequest(origin: RoutePoint, destination: RoutePoint, date: string, time: string, mode: RouteMode, shadePreference=DEFAULT_SHADE_PREFERENCE) {
  for (const p of [origin,destination]) if (!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||Math.abs(p.lat)>85||Math.abs(p.lon)>180) throw new Error('Selecciona un origen y un destino válidos.');
  const hour=time.trim().padStart(5,'0');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(hour)) throw new Error('Revisa la fecha y la hora de salida.');
  const at=new Date(`${date}T${hour}:00`);
  const [year,month,day]=date.split('-').map(Number);
  if (Number.isNaN(at.getTime())||at.getFullYear()!==year||at.getMonth()!==month-1||at.getDate()!==day) throw new Error('La fecha de salida no es válida.');
  if (!Number.isFinite(shadePreference)||shadePreference<0||shadePreference>1) throw new Error('La preferencia de sombra debe estar entre 0 y 100 %.');
  const frame=new Date(Math.floor(at.getTime()/1800000)*1800000);
  const sun=calculateSunPosition(frame,origin.lat,origin.lon);
  return {origin,destination,graph:'campus' as const,at:at.toISOString(),mode,shadePreference,speedMps:1.4,sun:{elevationDeg:sun.elevation,azimuthDeg:sun.azimuth}};
}

export async function fetchRoute(baseUrl: string, request: ReturnType<typeof buildRouteRequest>, signal?: AbortSignal, send: typeof fetch=fetch): Promise<CalculatedRoute> {
  const response=await send(`${baseUrl}/api/routes`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal});
  const data=await response.json();
  if (!response.ok) throw new Error(typeof data.error==='string'?data.error:'No se pudo calcular esta ruta.');
  if (!Array.isArray(data.geometry)||!Number.isFinite(data.lengthM)||!Number.isFinite(data.durationSeconds)) throw new Error('El servidor devolvió una ruta incompleta.');
  return data;
}
