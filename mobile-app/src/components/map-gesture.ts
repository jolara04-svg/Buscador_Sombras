export type MapTouch = { id: number | string; x: number; y: number };

// Rebase whenever a finger is added/lifted: changing contacts must never move the camera.
export function getMapGesture(previous: readonly MapTouch[], current: readonly MapTouch[]) {
  const before = [...previous].sort((a, b) => String(a.id).localeCompare(String(b.id))).slice(0, 2);
  const after = [...current].sort((a, b) => String(a.id).localeCompare(String(b.id))).slice(0, 2);
  if (!after.length || before.length !== after.length || after.some((touch, i) => touch.id !== before[i].id)) return null;
  const centroid = (points: readonly MapTouch[]) => ({
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  });
  const start = centroid(before), end = centroid(after);
  const span = (points: readonly MapTouch[]) => Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
  const zoom = after.length === 2 && span(after) > 1 && span(before) > 1 ? span(before) / span(after) : 1;
  return { dx: end.x - start.x, dy: end.y - start.y, zoom, twoFingers: after.length === 2 };
}
