import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { vertexShader, fragmentShader, getShadowCastMatrix } from '/project-shader.js';
import { project, evaluateEdge, distance } from './core.mjs';
import { atlasAt, makeAdjacency, dijkstra, largestComponent, summarizeRoute } from './routing.mjs';

const now = () => performance.now();
const yieldUI = () => new Promise(resolve => setTimeout(resolve, 0));
const memorySnapshots = [];
// Chromium informa solo heap JS, no memoria total ni toda la memoria WebGL.
// Registrar limites de la medicion evita llamar "pico total" a un valor parcial.
function sampleMemory(stage) {
  const m = performance.memory;
  memorySnapshots.push({ stage, usedJsHeapBytes: m?.usedJSHeapSize ?? null, totalJsHeapBytes: m?.totalJSHeapSize ?? null });
}
const sum = (values, key) => values.reduce((a, e) => a + e[key], 0);
const stats = values => {
  const ordered = [...values].sort((a, b) => a - b);
  return { min: ordered[0], median: ordered[Math.floor(ordered.length / 2)], max: ordered.at(-1),
    p95: ordered[Math.min(ordered.length - 1, Math.ceil(0.95 * ordered.length) - 1)] };
};
async function json(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url}: ${response.status}. Genera primero el grafo ampliado.`);
  return response.json();
}

let renderer, target, material, scene;
try {
  const started = now();
  sampleMemory('start');
  const [metadata, graph, generation] = await Promise.all([
    json('/scale/metadata'), json('/data/scale-graph.json'), json('/data/scale-generation.json')]);
  const graphLoaded = now();
  const { config, tiles } = metadata;
  if (graph.config.sizeM !== config.sizeM || graph.config.center.lat !== config.center.lat || graph.config.center.lon !== config.center.lon) throw new Error('Configuracion y grafo no coinciden; regenera --scale');
  const initialServerMemory = await json('/scale/memory');
  sampleMemory('graph-loaded');
  document.querySelector('#progress').textContent = `Grafo: ${graph.nodes.length} nodos, ${graph.edges.length} aristas. Cargando ${tiles.length} GLB…`;
  scene = new THREE.Scene();
  const projection = getShadowCastMatrix(config.azimuthDeg, config.elevationDeg, 1);
  material = new THREE.ShaderMaterial({ vertexShader, fragmentShader,
    uniforms: { shadowCastMatrix: { value: projection }, shadowColor: { value: new THREE.Vector4(1, 1, 1, 1) } },
    side: THREE.DoubleSide, depthTest: false, depthWrite: false, blending: THREE.NoBlending });
  const loader = new GLTFLoader();
  let downloadMs = 0, parseMs = 0, prepareMs = 0, geometryBytes = 0, triangles = 0, maxHeightM = 0;
  const bufferSet = new Set(), perTile = [];
  const buildingsStarted = now();
  for (const tile of tiles) {
    const t0 = now();
    const response = await fetch(tile.url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`GLB no disponible: ${tile.url}`);
    const buffer = await response.arrayBuffer(), t1 = now();
    const gltf = await loader.parseAsync(buffer, ''), t2 = now();
    gltf.scene.updateMatrixWorld(true);
    const geometries = [];
    gltf.scene.traverse(o => { if (o.isMesh) geometries.push(o.geometry.clone().applyMatrix4(o.matrixWorld)); });
    const bounds = new THREE.Box3();
    for (const g of geometries) { g.computeBoundingBox(); bounds.union(g.boundingBox); }
    const offset = project(tile.center.lat, tile.center.lon, config.center);
    const ratio = Math.cos(config.center.lat * Math.PI / 180) / Math.cos(tile.center.lat * Math.PI / 180);
    for (const g of geometries) {
      maxHeightM = Math.max(maxHeightM, g.boundingBox.max.z - bounds.min.z);
      g.translate(0, 0, -bounds.min.z); g.scale(ratio, ratio, 1); g.translate(offset[0], offset[1], 0);
      // El shader solo usa position e index: descartar normales, UV y otros
      // atributos que no aportan informacion a este paso de proyeccion.
      for (const key of Object.keys(g.attributes)) if (key !== 'position') g.deleteAttribute(key);
      for (const attr of [g.attributes.position, g.index].filter(Boolean)) {
        const arrayBuffer = attr.array.buffer;
        if (!bufferSet.has(arrayBuffer)) { bufferSet.add(arrayBuffer); geometryBytes += arrayBuffer.byteLength; }
      }
      const count = (g.index?.count || g.attributes.position.count) / 3;
      triangles += count;
      // Limites de la geometria YA proyectada. Descartar meshes por sus limites
      // originales perderia sombras de edificios que estan fuera de la mascara.
      const box = new THREE.Box3(), v = new THREE.Vector3();
      for (let i = 0; i < g.attributes.position.count; i++) {
        v.fromBufferAttribute(g.attributes.position, i).applyMatrix4(projection); box.expandByPoint(v);
      }
      const mesh = new THREE.Mesh(g, material); mesh.frustumCulled = false;
      mesh.userData.projectedBounds = box; mesh.userData.triangles = count;
      scene.add(mesh);
    }
    gltf.scene.traverse(o => {
      if (o.isMesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose(); }
    });
    const t3 = now();
    downloadMs += t1 - t0; parseMs += t2 - t1; prepareMs += t3 - t2;
    perTile.push({ tile: `${tile.x}/${tile.y}`, bytes: buffer.byteLength, downloadMs: t1 - t0, parseMs: t2 - t1, prepareMs: t3 - t2 });
    sampleMemory(`tile-${tile.x}-${tile.y}`);
  }
  // No mantener referencias a los buffers de geometria por este conjunto auxiliar.
  bufferSet.clear();
  const buildingsLoaded = now();
  const shadowReachM = maxHeightM / Math.tan(config.elevationDeg * Math.PI / 180);
  if (shadowReachM > config.casterMarginM) throw new Error(`Margen insuficiente: sombra maxima ${shadowReachM} m`);
  sampleMemory('buildings-ready');
  renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setSize(config.resolution, config.resolution); renderer.setPixelRatio(1); renderer.setClearColor(0, 1);
  target = new THREE.WebGLRenderTarget(config.resolution, config.resolution, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, stencilBuffer: false });
  const zHalf = config.zoneSizeM / 2;
  const camera = new THREE.OrthographicCamera(-zHalf, zHalf, zHalf, -zHalf, 0.1, 2000);
  const rgba = new Uint8Array(config.resolution ** 2 * 4);
  const canvas = document.querySelector('#preview'), ctx = canvas.getContext('2d');
  const imageSize = canvas.width;
  const allBounds = { minX: -config.sizeM / 2, minY: -config.sizeM / 2, maxX: config.sizeM / 2, maxY: config.sizeM / 2 };
  const toPixel = ([x, y]) => [(x - allBounds.minX) / config.sizeM * imageSize, (allBounds.maxY - y) / config.sizeM * imageSize];
  const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
  const scenarios = [];
  let firstNineZoneRequestMs;
  let finalView;
  // Ejecutar primero las nueve zonas para medir su primera peticion completa
  // sin haber calentado el shader con los escenarios pequenos.
  for (const cols of [3, 1, 2]) {
    const side = cols * config.zoneSizeM, half = side / 2;
    const bounds = { minX: -half, minY: -half, maxX: half, maxY: half };
    const inside = p => p[0] >= -half && p[0] < half && p[1] >= -half && p[1] < half;
    const edges = graph.edges.filter(e => e.geometry.every(inside));
    const components = largestComponent(edges);
    const connected = new Set(components.nodes);
    const candidates = graph.nodes.filter(n => connected.has(n.id));
    const nearest = p => candidates.reduce((best, n) => !best || distance(n.xy, p) < distance(best.xy, p) ? n : best, null);
    const pairs = [
      ['SO → NE', [-half * 0.8, -half * 0.8], [half * 0.8, half * 0.8]],
      ['NO → SE', [-half * 0.8, half * 0.8], [half * 0.8, -half * 0.8]],
      ['Oeste → Este', [-half * 0.8, 0], [half * 0.8, 0]]
    ].map(([name, a, b]) => ({ name, source: nearest(a)?.id, target: nearest(b)?.id }));
    if (!candidates.length) throw new Error('Zona sin componente conectado');
    const trials = [];
    for (let repetition = 0; repetition < config.repetitions; repetition++) {
      document.querySelector('#progress').textContent = `${cols ** 2} zonas · repetición ${repetition + 1}/${config.repetitions}`;
      await yieldUI();
      const t0 = now();
      const atlas = [], maskTimings = [];
      let renderMs = 0, readMs = 0, packMs = 0;
      for (let row = 0; row < cols; row++) for (let col = 0; col < cols; col++) {
        const x0 = bounds.minX + col * config.zoneSizeM, y0 = bounds.minY + row * config.zoneSizeM;
        let submittedTriangles = 0;
        for (const mesh of scene.children) {
          const b = mesh.userData.projectedBounds;
          mesh.visible = b.max.x >= x0 && b.min.x < x0 + config.zoneSizeM && b.max.y >= y0 && b.min.y < y0 + config.zoneSizeM;
          if (mesh.visible) submittedTriangles += mesh.userData.triangles;
        }
        camera.position.set(x0 + zHalf, y0 + zHalf, 1000);
        const r0 = now();
        renderer.setRenderTarget(target); renderer.render(scene, camera);
        const r1 = now();
        renderer.readRenderTargetPixels(target, 0, 0, config.resolution, config.resolution, rgba);
        const r2 = now();
        // Persistir solo 1 byte por pixel, reutilizando el staging RGBA y el
        // render target. No acumulamos nueve render targets de 4 MB cada uno.
        const mask = new Uint8Array(config.resolution ** 2);
        for (let p = 0; p < mask.length; p++) mask[p] = rgba[p * 4] >= 128 ? 1 : 0;
        atlas.push(mask);
        const r3 = now();
        renderMs += r1 - r0; readMs += r2 - r1; packMs += r3 - r2;
        maskTimings.push({ row, col, submittedTriangles, renderMs: r1 - r0, readbackMs: r2 - r1, packMs: r3 - r2 });
      }
      const t1 = now();
      const readMask = (x, y) => atlasAt(atlas, bounds, cols, config.zoneSizeM, config.resolution, x, y);
      const exposure = edges.map(e => evaluateEdge(e, readMask, config.sampleStepM, config.sunPenalty));
      const t2 = now();
      if (exposure.some(e => e.cost === null)) throw new Error('Muestra sin cobertura entre mascaras');
      const byDistance = makeAdjacency(edges, exposure, 'distance'), byShade = makeAdjacency(edges, exposure);
      const t3 = now();
      const zoneOf = id => {
        const [x, y] = nodeMap.get(id).xy;
        return `${Math.floor((x - bounds.minX) / config.zoneSizeM)},${Math.floor((y - bounds.minY) / config.zoneSizeM)}`;
      };
      const routes = pairs.map(pair => {
        const r0 = now(), shortest = summarizeRoute(dijkstra(byDistance, pair.source, pair.target), exposure), r1 = now();
        const shaded = summarizeRoute(dijkstra(byShade, pair.source, pair.target), exposure), r2 = now();
        if (shortest && shaded && (shaded.weightedCost > shortest.weightedCost + 1e-5 || shaded.lengthM + 1e-5 < shortest.lengthM)) throw new Error('Comparacion de rutas inconsistente');
        const routeZones = shaded ? [...new Set(shaded.nodes.map(zoneOf))] : [];
        return { ...pair, sourceCoordinate: nodeMap.get(pair.source)?.xy, targetCoordinate: nodeMap.get(pair.target)?.xy,
          sourceZone: zoneOf(pair.source), targetZone: zoneOf(pair.target), zonesCrossed: routeZones,
          shortestMs: r1 - r0, shadedMs: r2 - r1, shortest, shaded,
          extraDistanceM: shortest && shaded ? shaded.lengthM - shortest.lengthM : null,
          sunReductionM: shortest && shaded ? shortest.sunM - shaded.sunM : null };
      });
      const t4 = now();
      if (cols === 3 && repetition === 0) firstNineZoneRequestMs = t4 - started;
      // Consulta caliente: solo repetir Dijkstra contra adyacencia y pesos ya
      // preparados. Mantener esta cifra separada del coste de generar sombras.
      const cachedSearchTimes = [];
      for (let i = 0; i < 30; i++) {
        const pair = pairs[i % pairs.length], q0 = now();
        dijkstra(byShade, pair.source, pair.target); cachedSearchTimes.push(now() - q0);
      }
      sampleMemory(`${cols ** 2}-zones-trial-${repetition + 1}`);
      const trial = {
        repetition: repetition + 1, maskMs: t1 - t0, renderMs, readbackMs: readMs, packMs,
        evaluateEdgesMs: t2 - t1, adjacencyMs: t3 - t2, routeBatchMs: t4 - t3,
        pipelineMs: t4 - t0, cachedSearchMs: stats(cachedSearchTimes), maskTimings,
        samples: sum(exposure, 'samples'), shadeM: sum(exposure, 'shadeM'), sunM: sum(exposure, 'sunM'),
        atlasCpuBytes: atlas.reduce((a, m) => a + m.byteLength, 0),
        // Solo fracciones en Float32, sin IDs ni contenedores: limite inferior.
        compactExposurePayloadBytes: exposure.length * 4, routes
      };
      trials.push(trial);
      if (cols === 3 && repetition === config.repetitions - 1) {
        // Dibujar cada intervalo segun su muestra, evitando el verde uniforme
        // por arista que causaba confusion en la primera prueba.
        ctx.fillStyle = '#1c2c3c'; ctx.fillRect(0, 0, imageSize, imageSize);
        const image = ctx.createImageData(imageSize, imageSize);
        for (let py = 0; py < imageSize; py++) for (let px = 0; px < imageSize; px++) {
          const x = allBounds.minX + (px + 0.5) / imageSize * config.sizeM;
          const y = allBounds.maxY - (py + 0.5) / imageSize * config.sizeM;
          image.data.set(readMask(x, y) ? [224, 232, 242, 255] : [28, 44, 60, 255], (py * imageSize + px) * 4);
        }
        ctx.putImageData(image, 0, 0);
        for (const e of edges) for (let j = 1; j < e.geometry.length; j++) {
          const a = e.geometry[j - 1], b = e.geometry[j], count = Math.ceil(distance(a, b) / config.sampleStepM);
          const point = t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
          for (let i = 0; i < count; i++) {
            const midpoint = point((i + 0.5) / count);
            ctx.strokeStyle = readMask(...midpoint) ? '#22d54b' : '#f18439'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(...toPixel(point(i / count))); ctx.lineTo(...toPixel(point((i + 1) / count))); ctx.stroke();
          }
        }
        ctx.strokeStyle = '#72a9f0'; ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
        for (let i = 1; i < 3; i++) {
          ctx.beginPath(); ctx.moveTo(imageSize * i / 3, 0); ctx.lineTo(imageSize * i / 3, imageSize); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, imageSize * i / 3); ctx.lineTo(imageSize, imageSize * i / 3); ctx.stroke();
        }
        ctx.setLineDash([]);
        const background = ctx.getImageData(0, 0, imageSize, imageSize);
        const drawRoute = index => {
          ctx.putImageData(background, 0, 0);
          const pair = routes[index];
          for (const [route, color, lineWidth] of [[pair.shortest, '#38baff', 7], [pair.shaded, '#f554d0', 4]]) {
            if (!route) continue;
            ctx.strokeStyle = color; ctx.lineWidth = lineWidth;
            ctx.beginPath(); route.nodes.forEach((id, i) => { const p = toPixel(nodeMap.get(id).xy); if (i) ctx.lineTo(...p); else ctx.moveTo(...p); }); ctx.stroke();
          }
          for (const [id, label] of [[pair.source, 'A'], [pair.target, 'B']]) {
            const p = toPixel(nodeMap.get(id).xy);
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(...p, 10, 0, 2 * Math.PI); ctx.fill();
            ctx.fillStyle = '#111111'; ctx.font = 'bold 16px system-ui'; ctx.fillText(label, p[0] - 5, p[1] + 5);
          }
        };
        finalView = { routes, drawRoute };
        routes.forEach((route, i) => {
          const button = document.createElement('button'); button.textContent = route.name;
          button.onclick = () => drawRoute(i); document.querySelector('#routes').append(button);
        });
        drawRoute(0);
      }
      // Liberar referencias: la siguiente repeticion puede recoger el atlas.
      // El GC de JS no garantiza liberacion inmediata; las medidas lo reflejan.
      atlas.length = 0;
    }
    scenarios.push({ zones: cols ** 2, sideM: side, areaKm2: side ** 2 / 1e6, edges: edges.length,
      nodes: components.totalNodes, components: components.count, largestComponentNodes: components.nodes.length,
      repetitions: trials, medianPipelineMs: stats(trials.map(t => t.pipelineMs)).median,
      medianMaskMs: stats(trials.map(t => t.maskMs)).median,
      medianEvaluateEdgesMs: stats(trials.map(t => t.evaluateEdgesMs)).median,
      medianRouteBatchMs: stats(trials.map(t => t.routeBatchMs)).median });
  }
  const finished = now();
  scenarios.sort((a, b) => a.zones - b.zones);
  sampleMemory('complete-before-dispose');
  const finalServerMemory = await json('/scale/memory');
  const report = {
    generatedAt: new Date().toISOString(), config, generation,
    graph: { nodes: graph.nodes.length, edges: graph.edges.length, jsonBytes: generation.graphBytes },
    buildings: { tiles: tiles.length, requestedTiles: metadata.requestedTileCount,
      downloadedBytes: tiles.reduce((a, t) => a + t.bytes, 0), meshes: scene.children.length, triangles,
      retainedGeometryCpuBytes: geometryBytes, maxHeightM, shadowReachM, casterMarginM: config.casterMarginM, perTile },
    loadTimingMs: { graphAndMetadataFetchParse: graphLoaded - started, buildingStage: buildingsLoaded - buildingsStarted,
      glbDownload: downloadMs, glbParse: parseMs, glbPrepare: prepareMs,
      // Este total incluye inicializacion, nueve ensayos y visualizacion: no es
      // la latencia de una unica peticion de ruta.
      wholeBenchmarkWall: finished - started },
    memory: { snapshots: memorySnapshots,
      largestObservedJsHeapBytes: Math.max(...memorySnapshots.map(m => m.usedJsHeapBytes || 0)),
      geometryCpuBytes: geometryBytes, stagingRgbaCpuBytes: rgba.byteLength,
      singleRenderTargetColorBytes: config.resolution ** 2 * 4,
      serverInitial: initialServerMemory, serverFinal: finalServerMemory,
      caveat: 'Heap JS observado, buffers explicitos y RSS del servidor se informan por separado; no se suman ni representan el pico RSS de todo Chromium/GPU.' },
    scenarios,
    firstNineZoneRequestMs,
    correctness: { noUnknownSamples: true,
      interZonePairsSucceeded: finalView.routes.filter(r => r.shaded && r.sourceZone !== r.targetZone).length,
      comparisonsChecked: 'Coste ponderado de ruta sombreada <= coste de ruta corta; longitud de ruta corta <= sombreada' },
    limitations: ['Datos locales, sin latencia de Internet en peticiones de rutas', 'GLB cache no-store pero cache del sistema operativo no vaciada',
      'Sol fijo; suelo plano y normalizacion de alturas por chunk; sin arboles',
      'Tiles ausentes no certifican ausencia de edificios; margen comprobado solo con alturas cargadas',
      'Endpoints elegidos en componente debil mayor, sin snapping ni validacion de accesos',
      'Misma escena ampliada residente para comparar 1/4/9 zonas; se filtran meshes por bounds proyectados',
      'Tres repeticiones, no estudio de concurrencia ni prueba de todo Madrid']
  };
  if (report.correctness.interZonePairsSucceeded !== 3) throw new Error('No se consiguieron las tres rutas entre zonas; revisar conectividad');
  const fmt = n => n.toFixed(1);
  const table = document.createElement('table');
  table.innerHTML = '<tr><th>Zonas</th><th>Aristas</th><th>Máscaras ms</th><th>Evaluación ms</th><th>6 búsquedas ms</th><th>Proceso ms</th></tr>' + scenarios.map(s => `<tr><td>${s.zones}</td><td>${s.edges}</td><td>${fmt(s.medianMaskMs)}</td><td>${fmt(s.medianEvaluateEdgesMs)}</td><td>${fmt(s.medianRouteBatchMs)}</td><td>${fmt(s.medianPipelineMs)}</td></tr>`).join('');
  document.querySelector('#table').append(table);
  const summaries = finalView.routes.map(r => ({ ruta: r.name, zonas: r.zonesCrossed.length,
    cortaM: r.shortest?.lengthM, sombreadaM: r.shaded?.lengthM, solCortaM: r.shortest?.sunM, solSombreadaM: r.shaded?.sunM }));
  document.querySelector('#status').textContent = JSON.stringify({ loadTimingMs: report.loadTimingMs,
    firstNineZoneRequestMs: report.firstNineZoneRequestMs, memory: { jsHeapObservedMB: report.memory.largestObservedJsHeapBytes / 1048576,
      geometryMB: geometryBytes / 1048576, atlasMB: 9, stagingMB: 4, renderTargetColorMB: 4 }, routes: summaries,
    limitations: report.limitations }, null, 2);
  document.querySelector('#progress').textContent = 'Prueba completada. Selecciona una ruta para comparar distancia y sombra.';
  target.dispose(); material.dispose(); scene.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); renderer.dispose();
  window.experimentResult = report;
} catch (error) {
  window.experimentError = error.stack || String(error);
  document.querySelector('#status').textContent = window.experimentError;
  target?.dispose(); material?.dispose(); scene?.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); renderer?.dispose();
}
