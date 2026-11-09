import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { vertexShader, fragmentShader, getShadowCastMatrix } from '/project-shader.js';
import { project, maskAt, evaluateEdge, combineShadowReaders } from './core.mjs';

try {
  const start = performance.now();
  const [metadata, graph] = await Promise.all(['/metadata', '/data/graph.json'].map(async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}. Ejecuta primero generate.mjs.`);
    return response.json();
  }));
  const { config, tiles = [], tilesBySource = { buildings: tiles }, shadowSources = ['buildings'], shadowWeights } = metadata;
  const activeSources = shadowSources.filter(source => ['buildings', 'trees'].includes(source));
  const scenes = Object.fromEntries(activeSources.map(source => [source, new THREE.Scene()]));
  // Mismo shader de proyeccion; blanco opaco y sin blending para que la
  // superposicion de edificios siga siendo una union binaria de sombras.
  const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader,
    uniforms: { shadowCastMatrix: { value: getShadowCastMatrix(config.azimuthDeg, config.elevationDeg, 1) }, shadowColor: { value: new THREE.Vector4(1, 1, 1, 1) } },
    side: THREE.DoubleSide, depthTest: false, depthWrite: false, blending: THREE.NoBlending });
  const sourceStats = Object.fromEntries(activeSources.map(source => [source, { tiles: 0, meshes: 0, triangles: 0, maxHeightM: 0 }]));
  const loader = new GLTFLoader();
  // Secuencial para limitar memoria y peticiones simultaneas del laboratorio.
  for (const source of activeSources) for (const tile of tilesBySource[source] || []) {
    const stats = sourceStats[source];
    stats.tiles++;
    const gltf = await loader.loadAsync(tile.url);
    gltf.scene.updateMatrixWorld(true);
    const geometries = [];
    gltf.scene.traverse(object => {
      if (object.isMesh) geometries.push(object.geometry.clone().applyMatrix4(object.matrixWorld));
    });
    const bounds = new THREE.Box3();
    for (const g of geometries) { g.computeBoundingBox(); bounds.union(g.boundingBox); }
    const offset = project(tile.center.lat, tile.center.lon, config.center);
    const ratio = Math.cos(config.center.lat * Math.PI / 180) / Math.cos(tile.center.lat * Math.PI / 180);
    for (const g of geometries) {
      stats.maxHeightM = Math.max(stats.maxHeightM, g.boundingBox.max.z - bounds.min.z);
      g.translate(0, 0, -bounds.min.z);
      g.scale(ratio, ratio, 1);
      g.translate(offset[0], offset[1], 0);
      const mesh = new THREE.Mesh(g, material);
      mesh.frustumCulled = false; // La proyeccion desplaza vertices fuera del bounding box original.
      scenes[source].add(mesh); stats.meshes++;
      stats.triangles += (g.index?.count || g.attributes.position.count) / 3;
    }
    gltf.scene.traverse(object => {
      if (object.isMesh) {
        object.geometry.dispose();
        for (const m of Array.isArray(object.material) ? object.material : [object.material]) m.dispose();
      }
    });
  }
  const loaded = performance.now();
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(1);
  renderer.setSize(config.resolution, config.resolution);
  renderer.setClearColor(0x000000, 1);
  const half = config.sizeM / 2;
  const camera = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 2000);
  camera.position.set(0, 0, 1000);
  const target = new THREE.WebGLRenderTarget(config.resolution, config.resolution, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, stencilBuffer: false });
  const sourcePixels = {};
  for (const source of activeSources) {
    renderer.setRenderTarget(target); renderer.clear(); renderer.render(scenes[source], camera);
    const pixels = new Uint8Array(config.resolution ** 2 * 4);
    renderer.readRenderTargetPixels(target, 0, 0, config.resolution, config.resolution, pixels);
    sourcePixels[source] = pixels;
  }
  const rendered = performance.now();
  const read = performance.now();
  const bounds = { minX: -half, minY: -half, maxX: half, maxY: half };
  const readBuildings = activeSources.includes('buildings')
    ? (x, y) => maskAt(sourcePixels.buildings, config.resolution, config.resolution, bounds, x, y) : null;
  const readTrees = activeSources.includes('trees')
    ? (x, y) => maskAt(sourcePixels.trees, config.resolution, config.resolution, bounds, x, y) : null;
  // Sin fuentes configuradas es un escenario válido: exposición totalmente al sol.
  const readMask = activeSources.length ? combineShadowReaders(readBuildings, readTrees, shadowWeights) : () => 0;
  const edges = graph.edges.map(edge => evaluateEdge(edge, readMask, config.sampleStepM, config.sunPenalty));
  const sampled = performance.now();
  const canvas = document.querySelector('#preview'), ctx = canvas.getContext('2d');
  const image = ctx.createImageData(config.resolution, config.resolution);
  let shadedPixels = 0;
  // Canvas empieza arriba; WebGL empieza abajo. Invertir filas SOLO al visualizar.
  for (let y = 0; y < config.resolution; y++) for (let x = 0; x < config.resolution; x++) {
    const source = ((config.resolution - 1 - y) * config.resolution + x) * 4;
    const dest = (y * config.resolution + x) * 4;
    const xM = -half + (x + 0.5) / config.resolution * config.sizeM;
    const yM = half - (y + 0.5) / config.resolution * config.sizeM;
    const shadow = readMask(xM, yM) || 0;
    shadedPixels += shadow;
    image.data.set(shadow ? [Math.round(28 + 196 * shadow), Math.round(44 + 188 * shadow), Math.round(60 + 182 * shadow), 255] : [28, 44, 60, 255], dest);
  }
  ctx.putImageData(image, 0, 0);
  const toPixel = ([x, y]) => [(x + half) / config.sizeM * config.resolution, (half - y) / config.sizeM * config.resolution];
  graph.edges.forEach((edge, i) => {
    const fraction = edges[i].shadeFraction;
    ctx.strokeStyle = fraction === null ? '#eb67f0' : `rgb(${Math.round(245 - 210 * fraction)},${Math.round(125 + 95 * fraction)},65)`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(...toPixel(edge.geometry[0])); ctx.lineTo(...toPixel(edge.geometry[1])); ctx.stroke();
  });
  const sum = key => edges.reduce((a, e) => a + e[key], 0);
  const report = {
    experiment: config, generatedAt: new Date().toISOString(),
    graph: { nodes: graph.nodes.length, edges: edges.length, attribution: graph.attribution },
    buildings: { tiles: sourceStats.buildings?.tiles || 0, requestedTiles: metadata.requestedTileCount,
      meshes: sourceStats.buildings?.meshes || 0, triangles: sourceStats.buildings?.triangles || 0, maxHeightM: sourceStats.buildings?.maxHeightM || 0 },
    shadowSources: activeSources, shadowWeights, sources: sourceStats,
    mask: { width: config.resolution, height: config.resolution, metersPerPixel: config.sizeM / config.resolution,
      rgbaBytes: Object.values(sourcePixels).reduce((bytes, pixels) => bytes + pixels.byteLength, 0), shadedPixelFraction: shadedPixels / config.resolution ** 2 },
    timingMs: { loadAndPrepare: loaded - start, renderSubmission: rendered - loaded,
      readbackAndGpuCompletion: read - rendered, evaluateEdges: sampled - read },
    totals: { lengthM: sum('lengthM'), shadeM: sum('shadeM'), sunM: sum('sunM'), unknownM: sum('unknownM'), samples: sum('samples') },
    limitations: ['Sol de prueba, sin fecha solar calculada', 'Suelo plano y normalizacion vertical por chunk',
      'Cobertura y georreferencia de las capas no verificadas topograficamente',
      'No valida barreras ni accesos condicionales; grafo experimental', 'Tiempos de una ejecucion, no benchmark de produccion'],
    edges
  };
  // Prueba de control con edificio sintetico conocido: caja de 10 m de altura,
  // sol al sur a 45 grados. La sombra debe extenderse 10 m al norte.
  const controlScene = new THREE.Scene();
  const boxGeometry = new THREE.BoxGeometry(10, 10, 10);
  boxGeometry.translate(0, 0, 5);
  material.uniforms.shadowCastMatrix.value.copy(getShadowCastMatrix(180, 45, 1));
  const box = new THREE.Mesh(boxGeometry, material); box.frustumCulled = false;
  controlScene.add(box);
  renderer.setRenderTarget(target); renderer.clear(); renderer.render(controlScene, camera);
  const control = new Uint8Array(config.resolution ** 2 * 4);
  renderer.readRenderTargetPixels(target, 0, 0, config.resolution, config.resolution, control);
  const at = (x, y) => maskAt(control, config.resolution, config.resolution, bounds, x, y);
  report.control = { northShadow: at(0, 10), southSun: at(0, -10), beyondShadow: at(0, 20),
    halfShadowEdge: evaluateEdge({ id: 'control', geometry: [[0, 5], [0, 25]] }, at, 0.5, 4) };
  report.control.passed = report.control.northShadow === 1 && report.control.southSun === 0 && report.control.beyondShadow === 0 && Math.abs(report.control.halfShadowEdge.shadeFraction - 0.5) <= 0.05;
  if (!report.control.passed) throw new Error(`Fallo de control: ${JSON.stringify(report.control)}`);
  if (!(shadedPixels > 0 && shadedPixels < config.resolution ** 2)) throw new Error('Mascara real vacia o completamente sombreada');
  window.experimentResult = report;
  const { edges: _, ...summary } = report;
  document.querySelector('#status').textContent = JSON.stringify(summary, null, 2);
  boxGeometry.dispose(); target.dispose(); material.dispose();
  Object.values(scenes).forEach(scene => scene.traverse(object => { if (object.isMesh) object.geometry.dispose(); }));
  renderer.dispose();
} catch (error) {
  window.experimentError = error.stack || String(error);
  document.querySelector('#status').textContent = window.experimentError;
}
