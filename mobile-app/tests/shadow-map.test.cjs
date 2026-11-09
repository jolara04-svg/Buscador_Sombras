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

const { mercator, chunkReference, metersPerPixel } = load('shadow-map-projection.ts');
const { getShadowCastMatrix, shadowShaderMaterialDefault } = load('shadersSombras.ts');
const { DEFAULT_SHADOW_LAYER_SELECTION, DEFAULT_SHADOW_LAYER_WEIGHTS, normalizeShadowLayerWeights } = load('shadow-settings.ts');
const { sourceUrl, sourceOpacity } = load('shadow-map-sources.ts');
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
  assert.equal(sourceUrl(base, 'buildings', { buildings: false, trees: true }), null);
  assert.equal(sourceOpacity('trees', { trees: 0.75 }), 0.75);
});
