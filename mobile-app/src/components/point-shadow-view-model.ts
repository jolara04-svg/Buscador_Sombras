import type { ShadowInterval, ShadowState } from '@/components/point-shadow-query';

export type PointShadowSelection = {
  lat: number;
  lon: number;
};

export function formatSelectedPoint(point: PointShadowSelection) {
  return `${point.lat.toFixed(6)}, ${point.lon.toFixed(6)}`;
}

export function formatIntervalDuration(minutes: number) {
  const roundedMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(roundedMinutes / 60);
  const remainingMinutes = roundedMinutes % 60;
  if (hours === 0) return `${remainingMinutes} min`;
  if (remainingMinutes === 0) return `${hours} h`;
  return `${hours} h ${remainingMinutes} min`;
}

export function formatQueryDate(date: Date | string) {
  const resolved = new Date(date);
  if (Number.isNaN(resolved.getTime())) return 'Fecha no válida';
  const year = resolved.getFullYear();
  const month = String(resolved.getMonth() + 1).padStart(2, '0');
  const day = String(resolved.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function intervalColor(state: ShadowState) {
  return state === 'sol' ? '#f59e0b' : '#475569';
}

export function intervalLabel(interval: ShadowInterval) {
  return interval.estado === 'sol' ? 'Sol directo' : 'Sombra';
}
