const RADIUS = 6378137;
const TILE_COUNT = 2 ** 16;

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

// GLBs use metres east/north of the centre of their z16 tile (not the selected point).
/**
 * Calcula la referencia espacial y factor de escala local (en metros) para un chunk z16 a partir de su URL.
 * @param {string} url - URL completa de petición del chunk.
 * @returns {{x: number, y: number, scale: number}} Posición del centro del tile y factor de escala.
 */
export function chunkReference(url: string) {
  const parsed = new URL(url);
  const lat = Number(parsed.searchParams.get('lat'));
  const lon = Number(parsed.searchParams.get('lon'));
  const x = Math.floor((lon + 180) / 360 * TILE_COUNT);
  const y = Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * TILE_COUNT);
  const centerLat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 0.5) / TILE_COUNT)));
  return {
    x: ((x + 0.5) / TILE_COUNT - 0.5) * 2 * Math.PI * RADIUS,
    y: (0.5 - (y + 0.5) / TILE_COUNT) * 2 * Math.PI * RADIUS,
    scale: 1 / Math.cos(centerLat),
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
