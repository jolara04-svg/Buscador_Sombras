'use strict';

const { test } = require('node:test');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const THREE = require('three');

function load(relativePath) {
  const filename = path.resolve(__dirname, '..', 'src', 'components', relativePath);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function('exports', 'require', compiled)(exports, require);
  return exports;
}

const {
  mercator,
  chunkReference,
  metersPerPixel,
  shadowTilesForViewport,
  tileKey,
  tileOffsetFromReference,
  tilesAvailableInManifest,
} = load('shadow-map-projection.ts');
const { getShadowCastMatrix, shadowShaderMaterialDefault } = load('shadersSombras.ts');
const { DEFAULT_SHADOW_LAYER_SELECTION, DEFAULT_SHADOW_LAYER_WEIGHTS, normalizeShadowLayerWeights } = load('shadow-settings.ts');
const { sourceUrl, sourceOpacity, tileSourceUrl } = load('shadow-map-sources.ts');
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6,
  `${message}: ${actual} != ${expected}`);

test('mercator clamps latitude and preserves longitude metres', () => {
  const equator = mercator(0, 1);
  near(equator.x, 6378137 * Math.PI / 180, 'longitude');
  near(equator.y, 0, 'equator');
  assert.equal(mercator(90, 0).y, mercator(85.05112878, 0).y);
  assert.equal(mercator(-90, 0).y, mercator(-85.05112878, 0).y);
});

test('chunk reference returns the centre of the z16 tile and latitude scale', () => {
  const reference = chunkReference('http://localhost/chunk?lat=40.4168&lon=-3.7038');
  assert.ok(Number.isFinite(reference.x) && Number.isFinite(reference.y));
  assert.ok(reference.scale > 1);
  const sameTile = chunkReference('http://localhost/chunk?lat=40.4169&lon=-3.7037');
  near(reference.x, sameTile.x, 'tile centre x');
  near(reference.y, sameTile.y, 'tile centre y');
  near(reference.scale, sameTile.scale, 'tile scale');
});

test('shadow viewport selects several available tile positions around the selected chunk', () => {
  const base = 'http://localhost:3000/chunk?lat=40.4168&lon=-3.7038';
  const reference = chunkReference(base);
  const tiles = shadowTilesForViewport(base, {
    centerLat: 40.4168,
    centerLon: -3.7038,
    zoom: 16,
    width: 800,
    height: 450,
  });
  const keys = new Set(tiles.map(tile => `${tile.x}/${tile.y}`));
  assert.ok(tiles.length > 1, 'El viewport debe incluir más de un chunk');
  assert.ok(tiles.length <= 49, 'La precarga debe tener un límite razonable');
  assert.ok(keys.has(`${reference.tileX}/${reference.tileY}`), 'Debe mantenerse el chunk seleccionado');
  assert.ok(tiles.some(tile => tile.x === reference.tileX + 1 && tile.y === reference.tileY));
  assert.ok(tileOffsetFromReference({ x: reference.tileX + 1, y: reference.tileY, z: 16 }, reference).x > 0);
});

test('shadow viewport without dimensions falls back to the selected chunk', () => {
  const base = 'http://localhost:3000/chunk?lat=40.4168&lon=-3.7038';
  const reference = chunkReference(base);
  assert.deepEqual(shadowTilesForViewport(base), [{ x: reference.tileX, y: reference.tileY, z: 16 }]);
  assert.deepEqual(shadowTilesForViewport(base, { centerLat: 40.4168, centerLon: -3.7038, zoom: 16, width: 0, height: 450 }), [
    { x: reference.tileX, y: reference.tileY, z: 16 },
  ]);
});

test('shadow viewport keeps the selected chunk after panning and avoids duplicate tile coordinates', () => {
  const base = 'http://localhost:3000/chunk?lat=40.4168&lon=-3.7038';
  const reference = chunkReference(base);
  const tiles = shadowTilesForViewport(base, {
    centerLat: 40.4178,
    centerLon: -3.6900,
    zoom: 16,
    width: 390,
    height: 450,
  });
  const keys = tiles.map(tileKey);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.includes(`16/${reference.tileX}/${reference.tileY}`));
  assert.ok(tiles.some(tile => tile.x !== reference.tileX || tile.y !== reference.tileY));
});

test('shadow viewport limits precaching when the map is zoomed far out', () => {
  const base = 'http://localhost:3000/chunk?lat=40.4168&lon=-3.7038';
  const tiles = shadowTilesForViewport(base, {
    centerLat: 40.4168,
    centerLon: -3.7038,
    zoom: 3,
    width: 1920,
    height: 1080,
  });
  assert.ok(tiles.length <= 49);
  assert.ok(tiles.length > 1);
});

test('manifest filtering only keeps chunks available for the requested layer', () => {
  const tiles = [
    { x: 32093, y: 24711, z: 16 },
    { x: 32094, y: 24711, z: 16 },
    { x: 32095, y: 24711, z: 16 },
  ];
  const manifest = { 32093: ['24711'], 32094: ['24710'] };
  assert.deepEqual(tilesAvailableInManifest(tiles, manifest), [tiles[0]]);
  assert.deepEqual(tilesAvailableInManifest(tiles, {}), []);
});

test('tile offsets place east and south neighbours in the expected local directions', () => {
  const reference = chunkReference('http://localhost:3000/chunk?lat=40.4168&lon=-3.7038');
  const east = tileOffsetFromReference({ x: reference.tileX + 1, y: reference.tileY, z: 16 }, reference);
  const south = tileOffsetFromReference({ x: reference.tileX, y: reference.tileY + 1, z: 16 }, reference);
  assert.ok(east.x > 0);
  assert.ok(Math.abs(east.y) < 1e-9);
  assert.ok(south.y < 0);
  assert.ok(Math.abs(south.x) < 1e-9);
  near(Math.abs(east.x), Math.abs(south.y), 'tile spacing');
});

test('invalid chunk URLs are rejected before requesting manifests', () => {
  assert.throws(
    () => shadowTilesForViewport('http://localhost:3000/chunk?lat=invalid&lon=-3.7038'),
    /coordenadas válidas/,
  );
});

test('meters per pixel halves for every zoom level', () => {
  near(metersPerPixel(0), 2 * Math.PI * 6378137 / 256, 'zoom zero');
  near(metersPerPixel(16), metersPerPixel(15) / 2, 'zoom increment');
});

test('shadow projection follows azimuth and has no zenith displacement', () => {
  for (const [azimuth, x, y] of [[0, 0, -10], [90, -10, 0], [180, 0, 10], [270, 10, 0]]) {
    const point = new THREE.Vector3(0, 0, 10).applyMatrix4(getShadowCastMatrix(azimuth, 45, 1));
    near(point.x, x, `azimuth ${azimuth} x`);
    near(point.y, y, `azimuth ${azimuth} y`);
  }
  const zenith = new THREE.Vector3(3, 4, 10).applyMatrix4(getShadowCastMatrix(90, 90, 1));
  near(zenith.x, 3, 'zenith x');
  near(zenith.y, 4, 'zenith y');
});

test('shadow materials own independent matrix and color uniforms', () => {
  const first = shadowShaderMaterialDefault(0, 45, 1);
  const second = shadowShaderMaterialDefault(90, 45, 1);
  first.uniforms.shadowColor.value.w = 0;
  near(second.uniforms.shadowColor.value.w, 0.5, 'independent color');
  first.uniforms.shadowCastMatrix.value.elements[0] = 99;
  assert.notEqual(first.uniforms.shadowCastMatrix.value.elements[0],
    second.uniforms.shadowCastMatrix.value.elements[0]);
  first.dispose();
  second.dispose();
});

test('shadow sources expose both layers and configurable default weights', () => {
  assert.deepEqual(DEFAULT_SHADOW_LAYER_SELECTION, { buildings: true, trees: true });
  assert.deepEqual(DEFAULT_SHADOW_LAYER_WEIGHTS, { buildings: 1, trees: 0.75 });
  assert.deepEqual(normalizeShadowLayerWeights({ buildings: '2.5', trees: -1 }), { buildings: 2.5, trees: 0.75 });
  const base = 'http://localhost:3000/chunk?lat=40.4168&lon=-3.7038';
  assert.match(sourceUrl(base, 'trees'), /layer=trees/);
  assert.equal(tileSourceUrl(base, 'trees', 32096, 24711), 'http://localhost:3000/tiles/trees/16/32096/24711.glb');
  assert.equal(tileSourceUrl('https://example.test/api/chunk?lat=1&lon=2', 'buildings', 1, 2, 15), 'https://example.test/tiles/buildings/15/1/2.glb');
  assert.equal(sourceUrl(base, 'buildings', { buildings: false, trees: true }), null);
  assert.equal(sourceOpacity('trees', { trees: 0.75 }), 0.75);
});
