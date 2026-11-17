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
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();

  const julianDate =
    367 * year
    - Math.floor((7 * (year + Math.floor((month + 9) / 12))) / 4)
    + Math.floor((275 * month) / 9)
    + day
    + 1721013.5
    + ((hour + minute / 60) / 24)
    - 0.5 * Math.sign(100 * year + month - 190002.5)
    + 0.5;

  const daysSinceJ2000 = julianDate - 2451545.0;
  const meanLongitude = 280.460 + 0.9856474 * daysSinceJ2000;
  const normalizedMeanLongitude = meanLongitude % 360;
  const meanAnomaly = 357.528 + 0.9856003 * daysSinceJ2000;
  const meanAnomalyRadians = toRad(meanAnomaly % 360);
  const eclipticLongitude =
    normalizedMeanLongitude
    + 1.915 * Math.sin(meanAnomalyRadians)
    + 0.020 * Math.sin(2 * meanAnomalyRadians);
  const obliquity = 23.439 - 0.0000004 * daysSinceJ2000;
  const declination = Math.asin(Math.sin(toRad(obliquity)) * Math.sin(toRad(eclipticLongitude)));
  const greenwichMeanSiderealTime = 6.697375 + 0.0657098242 * daysSinceJ2000 + hour;
  const siderealDegrees = (greenwichMeanSiderealTime % 24) * 15;
  const localHourAngle = (siderealDegrees + longitude - normalizedMeanLongitude) % 360;
  const localHourAngleRadians = toRad(localHourAngle);
  const latitudeRadians = toRad(latitude);

  const elevationRadians = Math.asin(
    Math.sin(declination) * Math.sin(latitudeRadians)
    + Math.cos(declination) * Math.cos(latitudeRadians) * Math.cos(localHourAngleRadians),
  );
  const cosineAzimuth = (
    Math.sin(declination) - Math.sin(elevationRadians) * Math.sin(latitudeRadians)
  ) / (Math.cos(elevationRadians) * Math.cos(latitudeRadians));
  const azimuthRadians = Math.acos(Math.max(-1, Math.min(1, cosineAzimuth)));
  const azimuth = localHourAngleRadians > 0 ? toDeg(azimuthRadians) : 360 - toDeg(azimuthRadians);

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
    intervalos,
    minutosSol,
    minutosSombra,
  };
}

export function shadowStateLabel(state: ShadowState) {
  return state === 'sol' ? 'Sol directo' : 'Sombra';
}
