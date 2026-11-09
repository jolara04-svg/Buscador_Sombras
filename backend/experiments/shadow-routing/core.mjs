// Coordenadas locales: x este, y norte, en metros aproximados sobre el terreno.
// Se conserva el factor Mercator del centro, adecuado para este experimento de 512 m.
const R = 6378137;
const rad = Math.PI / 180;
export function project(lat, lon, center) {
  const scale = Math.cos(center.lat * rad);
  return [R * (lon - center.lon) * rad * scale,
    R * (Math.asinh(Math.tan(lat * rad)) - Math.asinh(Math.tan(center.lat * rad))) * scale];
}
export function unproject(x, y, center) {
  const scale = Math.cos(center.lat * rad);
  return { lon: center.lon + x / (R * scale * rad),
    lat: Math.atan(Math.sinh(Math.asinh(Math.tan(center.lat * rad)) + y / (R * scale))) / rad };
}
export function distance(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }

// readRenderTargetPixels comienza por la fila inferior: y norte crece hacia arriba.
// Fuera de cobertura se devuelve null: desconocido NO significa sol.
export function maskAt(pixels, width, height, bounds, x, y) {
  if (x < bounds.minX || x >= bounds.maxX || y < bounds.minY || y >= bounds.maxY) return null;
  const u = Math.floor((x - bounds.minX) / (bounds.maxX - bounds.minX) * width);
  const v = Math.floor((y - bounds.minY) / (bounds.maxY - bounds.minY) * height);
  return pixels[(v * width + u) * 4] >= 128 ? 1 : 0;
}

// Muestras en puntos medios. Cada muestra representa dl metros, no un voto
// arbitrario: esto evita sesgos cuando el ultimo intervalo es mas corto.
export function evaluateEdge(edge, readMask, stepM = 2, sunPenalty = 4) {
  if (!(stepM > 0) || !Number.isFinite(stepM) || !(sunPenalty >= 1) || !Number.isFinite(sunPenalty)) {
    throw new Error('Paso positivo y penalizacion finita >= 1 requeridos');
  }
  let lengthM = 0, shadeM = 0, unknownM = 0, samples = 0;
  for (let j = 1; j < edge.geometry.length; j++) {
    const a = edge.geometry[j - 1], b = edge.geometry[j];
    const len = distance(a, b), count = Math.ceil(len / stepM);
    lengthM += len;
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count, dl = len / count;
      const value = readMask(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
      samples++;
      if (value === null) unknownM += dl;
      else shadeM += value * dl;
    }
  }
  const complete = unknownM < 1e-7;
  const sunM = Math.max(0, lengthM - shadeM - unknownM);
  return { id: edge.id, lengthM, shadeM, sunM, unknownM, samples,
    shadeFraction: complete && lengthM > 0 ? shadeM / lengthM : null,
    cost: complete ? shadeM + sunPenalty * sunM : null };
}

// No se inventan cruces geometricos: solo conectamos identificadores OSM
// compartidos. Dos vias a distinta altura pueden cruzarse sin estar conectadas.
export function buildGraph(osm, config) {
  const sourceNodes = new Map(osm.elements.filter(e => e.type === 'node').map(n => [n.id, n]));
  const nodes = new Map(), edges = [];
  const allowed = new Set(['footway', 'pedestrian', 'path', 'steps', 'living_street', 'residential', 'service', 'unclassified', 'tertiary', 'secondary', 'primary', 'track', 'cycleway']);
  const half = config.sizeM / 2;
  for (const way of osm.elements.filter(e => e.type === 'way')) {
    const tags = way.tags || {};
    if (!allowed.has(tags.highway) || tags.area === 'yes' || tags.foot === 'no' || tags.foot === 'private' || tags.highway === 'cycleway' && !['yes', 'designated', 'permissive'].includes(tags.foot)) continue;
    if (['no', 'private'].includes(tags.access) && !['yes', 'designated', 'permissive'].includes(tags.foot)) continue;
    // Puentes/tuneles requieren altura o un modelo especial: se excluyen del ensayo plano.
    if (tags.bridge && tags.bridge !== 'no' || tags.tunnel && tags.tunnel !== 'no') continue;
    for (let i = 1; i < way.nodes.length; i++) {
      const a = sourceNodes.get(way.nodes[i - 1]), b = sourceNodes.get(way.nodes[i]);
      if (!a || !b) throw new Error('Respuesta OSM incompleta: faltan nodos');
      const pa = project(a.lat, a.lon, config.center), pb = project(b.lat, b.lon, config.center);
      // Conservar solo segmentos completos dentro de la mascara, sin cortar ni
      // conectar artificialmente caminos en el borde.
      if ([...pa, ...pb].some(v => v <= -half || v >= half) || distance(pa, pb) === 0) continue;
      for (const [n, xy] of [[a, pa], [b, pb]]) nodes.set(String(n.id), { id: String(n.id), lat: n.lat, lon: n.lon, xy, barrier: n.tags?.barrier || null });
      edges.push({ id: `${way.id}:${i - 1}`, source: String(a.id), target: String(b.id),
        wayId: String(way.id), geometry: [pa, pb], lengthM: distance(pa, pb),
        // La direccion de vehiculos no determina la peatonal.
        forward: tags['oneway:foot'] !== '-1', reverse: !['yes', '1', 'true'].includes(tags['oneway:foot']),
        highway: tags.highway, name: tags.name || null });
    }
  }
  return { schemaVersion: 1, attribution: '© OpenStreetMap contributors — ODbL',
    source: 'https://www.openstreetmap.org/copyright', generatedAt: new Date().toISOString(),
    config, coordinateSystem: 'local east/north metres; fixed Mercator scale at center',
    nodes: [...nodes.values()], edges };
}
