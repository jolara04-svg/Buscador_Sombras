// Servidor LOCAL del laboratorio. No modifica los endpoints de produccion.
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const app = express();
const base = __dirname;
const backend = path.resolve(base, '../..');
const mobile = path.resolve(backend, '../mobile-app');
const config = require('./config.json');
const scaleConfig = require('./scale-config.json');
const layerDefinitions = {
  buildings: { directory: 'madrid_chunks', manifest: require('../../madrid_chunks/manifest.json') },
  trees: { directory: 'madrid_trees', manifest: require('../../madrid_trees/manifest.json') }
};
const ts = require(path.join(mobile, 'node_modules/typescript'));
const n = 2 ** 16;
const defaultWeights = { buildings: 1, trees: 0.75 };
function shadowSettings(rawConfig) {
  const requested = Array.isArray(rawConfig.shadowSources) ? rawConfig.shadowSources : ['buildings'];
  const sources = [...new Set(requested)].filter(source => Object.hasOwn(layerDefinitions, source));
  const shadowWeights = Object.fromEntries(Object.entries(defaultWeights).map(([source, fallback]) => {
    const value = rawConfig.shadowWeights?.[source];
    return [source, Number.isFinite(value) && value >= 0 ? value : fallback];
  }));
  return { sources, shadowWeights };
}
function tilesFor(config) {
  const { sources, shadowWeights } = shadowSettings(config);
  const radiusTiles = Math.ceil((config.casterMarginM || 0) / 512) + 2;
  const tx = Math.floor((config.center.lon + 180) / 360 * n);
  const ty = Math.floor((1 - Math.asinh(Math.tan(config.center.lat * Math.PI / 180)) / Math.PI) / 2 * n);
  const tilesBySource = {};
  for (const source of sources) {
    const { directory, manifest } = layerDefinitions[source];
    const tiles = [];
    for (let x = tx - radiusTiles; x <= tx + radiusTiles; x++) for (let y = ty - radiusTiles; y <= ty + radiusTiles; y++) {
      const file = path.join(backend, directory, `16/${x}/${y}.glb`);
      if (manifest[x]?.includes(String(y)) && fs.existsSync(file)) tiles.push({ x, y, url: `/tiles/${source}/16/${x}/${y}.glb`,
        center: { lon: ((x + 0.5) / n) * 360 - 180,
          lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 0.5) / n))) * 180 / Math.PI } });
    }
    tilesBySource[source] = tiles;
  }
  return { sources, shadowWeights, tilesBySource };
}
const demoSources = tilesFor(config);
// Contexto de edificios fuera de la mascara: sus sombras pueden entrar en ella.
app.get('/metadata', (_, res) => res.json({ config: { ...config, ...shadowSettings(config) },
  // Conserva el campo historico para clientes que solo conocen edificios.
  tiles: demoSources.tilesBySource.buildings || [], tilesBySource: demoSources.tilesBySource,
  shadowSources: demoSources.sources, shadowWeights: demoSources.shadowWeights, requestedTileCount: 25 }));
// Cobertura del ensayo ampliado mas un margen para edificios que proyectan
// sombra desde fuera. Se conserva un unico grafo: las fronteras entre mascaras
// no cortan las conexiones peatonales.
const radius = (scaleConfig.sizeM / 2 + scaleConfig.casterMarginM) / (6378137 * Math.cos(scaleConfig.center.lat * Math.PI / 180));
const toTile = (lat, lon) => ({ x: Math.floor((lon + 180) / 360 * n), y: Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n) });
const sw = toTile(scaleConfig.center.lat - radius * 180 / Math.PI, scaleConfig.center.lon - radius * 180 / Math.PI);
const ne = toTile(scaleConfig.center.lat + radius * 180 / Math.PI, scaleConfig.center.lon + radius * 180 / Math.PI);
const scaleSettings = shadowSettings(scaleConfig);
const scaleTilesBySource = {};
let requestedScaleTiles = 0;
for (const source of scaleSettings.sources) {
  const { directory, manifest } = layerDefinitions[source];
  const tiles = [];
  for (let x = sw.x; x <= ne.x; x++) for (let y = ne.y; y <= sw.y; y++) {
    requestedScaleTiles++;
    const file = path.join(backend, directory, `16/${x}/${y}.glb`);
    if (manifest[x]?.includes(String(y)) && fs.existsSync(file)) tiles.push({ x, y,
      url: `/tiles/${source}/16/${x}/${y}.glb`, bytes: fs.statSync(file).size,
      center: { lon: ((x + 0.5) / n) * 360 - 180,
        lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 0.5) / n))) * 180 / Math.PI } });
  }
  scaleTilesBySource[source] = tiles;
}
app.get('/scale/metadata', (_, res) => res.json({ config: { ...scaleConfig, ...scaleSettings },
  tiles: scaleTilesBySource.buildings || [], tilesBySource: scaleTilesBySource,
  shadowSources: scaleSettings.sources, shadowWeights: scaleSettings.shadowWeights, requestedTileCount: requestedScaleTiles }));
app.get('/scale/memory', (_, res) => res.json({ process: 'Express laboratory server only; browser excluded', ...process.memoryUsage() }));
// Reutilizacion directa del shader actual, compilado sin modificar la app.
app.get('/project-shader.js', (_, res) => {
  const source = fs.readFileSync(path.join(mobile, 'src/components/shadersSombras.ts'), 'utf8');
  res.type('js').send(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText);
});
app.use('/three', express.static(path.join(mobile, 'node_modules/three')));
app.use('/tiles', express.static(path.join(backend, 'madrid_chunks')));
app.use('/tiles/buildings', express.static(path.join(backend, 'madrid_chunks')));
app.use('/tiles/trees', express.static(path.join(backend, 'madrid_trees')));
app.use(express.static(base));
const port = Number(process.env.PORT || 3217);
const server = app.listen(port, '127.0.0.1', error => {
  if (error) { console.error(`No se pudo abrir el laboratorio en ${port}: ${error.message}`); process.exitCode = 1; return; }
  console.log(`Laboratorio: http://127.0.0.1:${server.address().port}`);
});
