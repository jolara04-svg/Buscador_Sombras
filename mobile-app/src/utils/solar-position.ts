export type SunDirection = {
  x: number;
  y: number;
  z: number;
};

export type SolarPosition = {
  elevation: number;
  azimuth: number;
  direction: SunDirection;
  isAboveHorizon: boolean;
  nearHorizon: boolean;
};

const HORIZON_TOLERANCE_DEGREES = 1;
const JULIAN_DATE_UNIX_EPOCH = 2440587.5;
const JULIAN_DATE_J2000 = 2451545;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number) {
  return (radians * 180) / Math.PI;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizeDegrees(degrees: number) {
  return ((degrees % 360) + 360) % 360;
}

function normalizeSignedDegrees(degrees: number) {
  const normalized = normalizeDegrees(degrees);
  return normalized > 180 ? normalized - 360 : normalized;
}

export function calculateSunPosition(
  date: Date,
  latitude: number,
  longitude: number,
): SolarPosition {
  const timestamp = date.getTime();
  if (!Number.isFinite(timestamp)) {
    throw new Error('La fecha no es válida');
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('La latitud debe estar entre -90 y 90 grados');
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('La longitud debe estar entre -180 y 180 grados');
  }

  const julianDate = timestamp / 86400000 + JULIAN_DATE_UNIX_EPOCH;
  const daysSinceJ2000 = julianDate - JULIAN_DATE_J2000;

  const meanLongitude = normalizeDegrees(280.46 + 0.9856474 * daysSinceJ2000);
  const meanAnomaly = toRadians(normalizeDegrees(357.528 + 0.9856003 * daysSinceJ2000));
  const eclipticLongitude =
    meanLongitude +
    1.915 * Math.sin(meanAnomaly) +
    0.02 * Math.sin(2 * meanAnomaly);
  const obliquity = toRadians(23.439 - 0.0000004 * daysSinceJ2000);
  const eclipticLongitudeRadians = toRadians(eclipticLongitude);

  const rightAscension = normalizeDegrees(
    toDegrees(
      Math.atan2(
        Math.cos(obliquity) * Math.sin(eclipticLongitudeRadians),
        Math.cos(eclipticLongitudeRadians),
      ),
    ),
  );
  const declination = Math.asin(
    clamp(Math.sin(obliquity) * Math.sin(eclipticLongitudeRadians), -1, 1),
  );

  const greenwichSiderealTime = normalizeDegrees(
    280.46061837 + 360.98564736629 * daysSinceJ2000,
  );
  const hourAngle = normalizeSignedDegrees(
    greenwichSiderealTime + longitude - rightAscension,
  );

  const latitudeRadians = toRadians(latitude);
  const hourAngleRadians = toRadians(hourAngle);
  const elevation = Math.asin(
    clamp(
      Math.sin(declination) * Math.sin(latitudeRadians) +
        Math.cos(declination) *
          Math.cos(latitudeRadians) *
          Math.cos(hourAngleRadians),
      -1,
      1,
    ),
  );

  const azimuth = normalizeDegrees(
    toDegrees(
      Math.atan2(
        Math.sin(hourAngleRadians),
        Math.cos(hourAngleRadians) * Math.sin(latitudeRadians) -
          Math.tan(declination) * Math.cos(latitudeRadians),
      ),
    ) + 180,
  );
  const elevationDegrees = toDegrees(elevation);
  const elevationCosine = Math.cos(elevation);
  const azimuthRadians = toRadians(azimuth);

  return {
    elevation: elevationDegrees,
    azimuth,
    direction: {
      x: elevationCosine * Math.sin(azimuthRadians),
      y: Math.sin(elevation),
      z: elevationCosine * Math.cos(azimuthRadians),
    },
    isAboveHorizon: elevationDegrees > 0,
    nearHorizon: Math.abs(elevationDegrees) <= HORIZON_TOLERANCE_DEGREES,
  };
}
