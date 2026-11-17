export type SolarPosition = {
  elevation: number;
  azimuth: number;
};

export type ShadowState = 'sol' | 'sombra';

export type ShadowSample = SolarPosition & {
  minuto: number;
  fecha: Date;
};

export type ShadowInterval = {
  estado: ShadowState;
  inicioMinuto: number;
  finMinuto: number;
  inicio: string;
  fin: string;
  duracionMinutos: number;
};

export type ShadowTimeline = {
  fecha: Date;
  latitude: number;
  longitude: number;
  intervalos: ShadowInterval[];
  minutosSol: number;
  minutosSombra: number;
};

export type ShadowTimelineOptions = {
  date: Date | string;
  latitude: number;
  longitude: number;
  startMinute?: number;
  endMinute?: number;
  stepMinutes?: number;
  isShadowed?: (sample: ShadowSample) => boolean;
};

const MINUTES_PER_DAY = 24 * 60;

function toRad(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function toDeg(radians: number) {
  return (radians * 180) / Math.PI;
}

/**
 * Calcula la posición solar simplificada para una fecha y coordenada geográfica.
 * Se mantiene como función pura para que la consulta puntual pueda probarse sin montar React Native.
 */
export function calculateSunPosition(date: Date, latitude: number, longitude: number): SolarPosition {
  if (Number.isNaN(date.getTime())) {
    return { elevation: Number.NaN, azimuth: Number.NaN };
  }

  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 0);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000);
  const decimalHour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const yearLength = new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
  const fractionalYear = (2 * Math.PI / yearLength) * (dayOfYear - 1 + (decimalHour - 12) / 24);
  const declination =
    0.006918
    - 0.399912 * Math.cos(fractionalYear)
    + 0.070257 * Math.sin(fractionalYear)
    - 0.006758 * Math.cos(2 * fractionalYear)
    + 0.000907 * Math.sin(2 * fractionalYear)
    - 0.002697 * Math.cos(3 * fractionalYear)
    + 0.00148 * Math.sin(3 * fractionalYear);
  const latitudeRadians = toRad(latitude);
  const hourAngleRadians = toRad((decimalHour - 12) * 15);
  const elevationRadians = Math.asin(
    Math.sin(latitudeRadians) * Math.sin(declination)
    + Math.cos(latitudeRadians) * Math.cos(declination) * Math.cos(hourAngleRadians),
  );
  const azimuthRadians = Math.atan2(
    Math.sin(hourAngleRadians),
    Math.cos(hourAngleRadians) * Math.sin(latitudeRadians) - Math.tan(declination) * Math.cos(latitudeRadians),
  );
  const azimuth = (toDeg(azimuthRadians) + 180 + 360) % 360;

  return {
    elevation: toDeg(elevationRadians),
    azimuth,
  };
}

export function formatMinute(minute: number) {
  const normalized = Math.max(0, Math.min(MINUTES_PER_DAY, Math.round(minute)));
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function resolveDate(date: Date | string) {
  const resolved = new Date(date);
  if (Number.isNaN(resolved.getTime())) {
    throw new Error('La fecha de la consulta no es válida.');
  }
  resolved.setHours(0, 0, 0, 0);
  return resolved;
}

function normalizeMinute(value: number, fallback: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(MINUTES_PER_DAY, value)) : fallback;
}

function validateCoordinates(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('La latitud debe estar entre -90 y 90 grados.');
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('La longitud debe estar entre -180 y 180 grados.');
  }
}

function appendInterval(intervals: ShadowInterval[], estado: ShadowState, inicioMinuto: number, finMinuto: number) {
  const previous = intervals[intervals.length - 1];
  if (previous && previous.estado === estado && previous.finMinuto === inicioMinuto) {
    previous.finMinuto = finMinuto;
    previous.fin = formatMinute(finMinuto);
    previous.duracionMinutos = finMinuto - previous.inicioMinuto;
    return;
  }

  intervals.push({
    estado,
    inicioMinuto,
    finMinuto,
    inicio: formatMinute(inicioMinuto),
    fin: formatMinute(finMinuto),
    duracionMinutos: finMinuto - inicioMinuto,
  });
}

/**
 * Genera franjas horarias para el punto seleccionado.
 * Por defecto, la noche se considera sombra y el día se considera sol directo.
 * `isShadowed` permite conectar una máscara geométrica de edificios o árboles cuando esté disponible.
 */
export function buildShadowTimeline({
  date,
  latitude,
  longitude,
  startMinute = 0,
  endMinute = MINUTES_PER_DAY,
  stepMinutes = 15,
  isShadowed,
}: ShadowTimelineOptions): ShadowTimeline {
  validateCoordinates(latitude, longitude);
  const baseDate = resolveDate(date);
  const start = normalizeMinute(startMinute, 0);
  const end = normalizeMinute(endMinute, MINUTES_PER_DAY);

  if (end <= start) {
    throw new Error('La hora final debe ser posterior a la hora inicial.');
  }
  if (!Number.isFinite(stepMinutes) || stepMinutes <= 0) {
    throw new Error('El intervalo de muestreo debe ser mayor que cero.');
  }

  const intervals: ShadowInterval[] = [];
  let minutosSol = 0;
  let minutosSombra = 0;

  for (let minute = start; minute < end; minute += stepMinutes) {
    const intervalEnd = Math.min(end, minute + stepMinutes);
    const sampleMinute = minute + (intervalEnd - minute) / 2;
    const sampleDate = new Date(baseDate);
    sampleDate.setMinutes(sampleMinute);
    const solar = calculateSunPosition(sampleDate, latitude, longitude);
    const sample: ShadowSample = { ...solar, minuto: sampleMinute, fecha: sampleDate };
    const estado: ShadowState = isShadowed?.(sample) || solar.elevation <= 0 ? 'sombra' : 'sol';

    if (estado === 'sol') minutosSol += intervalEnd - minute;
    else minutosSombra += intervalEnd - minute;
    appendInterval(intervals, estado, minute, intervalEnd);
  }

  return {
    fecha: baseDate,
    latitude,
    longitude,
    intervalos: intervals,
    minutosSol,
    minutosSombra,
  };
}

export function shadowStateLabel(state: ShadowState) {
  return state === 'sol' ? 'Sol directo' : 'Sombra';
}
