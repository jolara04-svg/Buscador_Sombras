const RADIUS = 6378137;
const TILE_COUNT = 2 ** 16;
const WORLD_METERS = 2 * Math.PI * RADIUS;

export type TileCoordinate = { x: number; y: number; z: number };
export type ShadowViewport = {
  centerLat: number;
  centerLon: number;
  zoom: number;
  width: number;
  height: number;
};

/**
 * Convierte latitud y longitud a coordenadas de proyección Web Mercator en metros.
 * @param {number} lat - Latitud geográfica en grados.
 * @param {number} lon - Longitud geográfica en grados.
 * @returns {{x: number, y: number}} Coordenadas proyectadas en metros.
 */
export function mercator(lat: number, lon: number) {
  const radians = Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI / 180;
  return { x: RADIUS * lon * Math.PI / 180, y: RADIUS * Math.asinh(Math.tan(radians)) };
}

export function tileCoordinates(lat: number, lon: number, zoom = 16): TileCoordinate {
  const count = 2 ** zoom;
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const radians = clampedLat * Math.PI / 180;
  return {
    x: Math.floor(((lon + 180) / 360) * count),
    y: Math.floor(((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * count),
    z: zoom,
  };
}

export function tileCenterMercator(x: number, y: number, zoom = 16) {
  const count = 2 ** zoom;
  return {
    x: ((x + 0.5) / count - 0.5) * WORLD_METERS,
    y: (0.5 - (y + 0.5) / count) * WORLD_METERS,
  };
}

export function tileCoordinatesFromChunkUrl(url: string, zoom = 16) {
  const parsed = new URL(url);
  const lat = Number(parsed.searchParams.get('lat'));
  const lon = Number(parsed.searchParams.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('La URL del chunk no contiene coordenadas válidas.');
  }
  return tileCoordinates(lat, lon, zoom);
}

/**
 * Devuelve las teselas z16 que cubren el viewport actual, con un anillo de
 * precarga. El límite evita disparar cientos de peticiones cuando Leaflet se
 * aleja mucho, manteniendo siempre la tesela seleccionada en el conjunto.
 */
export function shadowTilesForViewport(
  chunkUrl: string,
  viewport?: ShadowViewport | null,
  padding = 1,
  maxRadius = 3,
) {
  const origin = tileCoordinatesFromChunkUrl(chunkUrl);
  if (!viewport || viewport.width <= 0 || viewport.height <= 0) {
    return [origin];
  }

  const center = tileCoordinates(viewport.centerLat, viewport.centerLon);
  const tileWidth = WORLD_METERS / TILE_COUNT;
  const pixelsAtZoom16 = metersPerPixel(viewport.zoom);
  const radiusX = Math.min(maxRadius, Math.max(0, Math.ceil(viewport.width * pixelsAtZoom16 / (2 * tileWidth)) + padding));
  const radiusY = Math.min(maxRadius, Math.max(0, Math.ceil(viewport.height * pixelsAtZoom16 / (2 * tileWidth)) + padding));
  const tiles: TileCoordinate[] = [];

  for (let y = Math.max(0, center.y - radiusY); y <= Math.min(TILE_COUNT - 1, center.y + radiusY); y += 1) {
    for (let dx = -radiusX; dx <= radiusX; dx += 1) {
      const x = ((center.x + dx) % TILE_COUNT + TILE_COUNT) % TILE_COUNT;
      tiles.push({ x, y, z: 16 });
    }
  }

  tiles.sort((a, b) => {
    const distanceA = Math.abs(a.x - center.x) + Math.abs(a.y - center.y);
    const distanceB = Math.abs(b.x - center.x) + Math.abs(b.y - center.y);
    return distanceA - distanceB || a.y - b.y || a.x - b.x;
  });

  if (!tiles.some((tile) => tile.x === origin.x && tile.y === origin.y)) {
    tiles.unshift(origin);
  }
  return tiles;
}

export function tileOffsetFromReference(tile: TileCoordinate, reference: { x: number; y: number; scale: number }) {
  const centre = tileCenterMercator(tile.x, tile.y, tile.z);
  return {
    x: (centre.x - reference.x) / reference.scale,
    y: (centre.y - reference.y) / reference.scale,
  };
}

// GLBs use metres east/north of the centre of their z16 tile (not the selected point).
/**
 * Calcula la referencia espacial y factor de escala local (en metros) para un chunk z16 a partir de su URL.
 * @param {string} url - URL completa de petición del chunk.
 * @returns {{x: number, y: number, scale: number}} Posición del centro del tile y factor de escala.
 */
export function chunkReference(url: string) {
  const { x, y } = tileCoordinatesFromChunkUrl(url);
  const centerLat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 0.5) / TILE_COUNT)));
  return {
    ...tileCenterMercator(x, y),
    scale: 1 / Math.cos(centerLat),
    tileX: x,
    tileY: y,
  };
}

/**
 * Calcula la resolución espacial en metros por píxel para un nivel de zoom dado en Web Mercator.
 * @param {number} zoom - Nivel de zoom del mapa.
 * @returns {number} Metros por píxel.
 */
export function metersPerPixel(zoom: number) {
  return 2 * Math.PI * RADIUS / (256 * 2 ** zoom);
}
