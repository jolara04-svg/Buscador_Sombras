import type { SunDirection } from './solar-position';

export type ShadowPoint = {
  x: number;
  z: number;
};

type CubeVertex = ShadowPoint & {
  y: number;
};

const EPSILON = 1e-8;

function cross(
  origin: ShadowPoint,
  first: ShadowPoint,
  second: ShadowPoint,
) {
  return (
    (first.x - origin.x) * (second.z - origin.z) -
    (first.z - origin.z) * (second.x - origin.x)
  );
}

function convexHull(points: ShadowPoint[]) {
  const sortedPoints = [...points].sort((first, second) => {
    if (first.x !== second.x) return first.x - second.x;
    return first.z - second.z;
  });
  const uniquePoints = sortedPoints.filter(
    (point, index) =>
      index === 0 ||
      Math.abs(point.x - sortedPoints[index - 1].x) > EPSILON ||
      Math.abs(point.z - sortedPoints[index - 1].z) > EPSILON,
  );

  if (uniquePoints.length < 3) return [];

  const lower: ShadowPoint[] = [];
  for (const point of uniquePoints) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], point) <= EPSILON
    ) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper: ShadowPoint[] = [];
  for (let index = uniquePoints.length - 1; index >= 0; index -= 1) {
    const point = uniquePoints[index];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], point) <= EPSILON
    ) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function createCubeVertices(size: number): CubeVertex[] {
  const halfSize = size / 2;
  return [-halfSize, halfSize].flatMap((x) =>
    [0, size].flatMap((y) =>
      [-halfSize, halfSize].map((z) => ({ x, y, z })),
    ),
  );
}

function clipPolygon(
  points: ShadowPoint[],
  isInside: (point: ShadowPoint) => boolean,
  intersection: (first: ShadowPoint, second: ShadowPoint) => ShadowPoint,
) {
  if (points.length === 0) return [];

  const clipped: ShadowPoint[] = [];
  let previous = points[points.length - 1];
  let previousInside = isInside(previous);

  for (const current of points) {
    const currentInside = isInside(current);
    if (currentInside !== previousInside) {
      clipped.push(intersection(previous, current));
    }
    if (currentInside) clipped.push(current);
    previous = current;
    previousInside = currentInside;
  }

  return clipped;
}

function clipToPlane(points: ShadowPoint[], planeSize: number) {
  const halfSize = planeSize / 2;
  let clipped = points;
  clipped = clipPolygon(
    clipped,
    (point) => point.x >= -halfSize,
    (first, second) => ({
      x: -halfSize,
      z: first.z + ((second.z - first.z) * (-halfSize - first.x)) / (second.x - first.x),
    }),
  );
  clipped = clipPolygon(
    clipped,
    (point) => point.x <= halfSize,
    (first, second) => ({
      x: halfSize,
      z: first.z + ((second.z - first.z) * (halfSize - first.x)) / (second.x - first.x),
    }),
  );
  clipped = clipPolygon(
    clipped,
    (point) => point.z >= -halfSize,
    (first, second) => ({
      x: first.x + ((second.x - first.x) * (-halfSize - first.z)) / (second.z - first.z),
      z: -halfSize,
    }),
  );
  clipped = clipPolygon(
    clipped,
    (point) => point.z <= halfSize,
    (first, second) => ({
      x: first.x + ((second.x - first.x) * (halfSize - first.z)) / (second.z - first.z),
      z: halfSize,
    }),
  );
  return clipped;
}

export function projectCubeShadow(
  sunDirection: SunDirection,
  cubeSize = 1,
  planeSize = 6,
): ShadowPoint[] {
  if (
    !Number.isFinite(cubeSize) ||
    cubeSize <= 0 ||
    !Number.isFinite(planeSize) ||
    planeSize <= 0
  ) {
    return [];
  }

  const directionLength = Math.hypot(
    sunDirection.x,
    sunDirection.y,
    sunDirection.z,
  );
  if (directionLength <= EPSILON) return [];

  const normalizedY = sunDirection.y / directionLength;
  if (normalizedY <= EPSILON) return [];

  const normalizedX = sunDirection.x / directionLength;
  const normalizedZ = sunDirection.z / directionLength;
  const projectedPoints = createCubeVertices(cubeSize).map((vertex) => ({
    x: vertex.x - (vertex.y * normalizedX) / normalizedY,
    z: vertex.z - (vertex.y * normalizedZ) / normalizedY,
  }));

  return clipToPlane(convexHull(projectedPoints), planeSize);
}
