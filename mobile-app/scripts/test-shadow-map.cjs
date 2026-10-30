const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const THREE = require('three');
function load(name) {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/components', name), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const bindings = {};
  new Function('exports', 'require', compiled)(bindings, require);
  return bindings;
}
const { chunkReference, mercator, metersPerPixel } = load('shadow-map-projection.ts');
const { getShadowCastMatrix, shadowShaderMaterialDefault } = load('shadersSombras.ts');
const near = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-6, `${message}: ${a} != ${b}`);
const reference = chunkReference('http://localhost:3000/chunk?lat=40.4168&lon=-3.7038');
// Compare against Leaflet's independent Slippy pixel formula at multiple zooms and viewport sizes.
function leaflet(lat, lon, zoom) {
  const size = 256 * 2 ** zoom;
  return { x: (lon + 180) / 360 * size,
    y: (1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2 * size };
}
for (const zoom of [15, 16, 19]) for (const [width, height] of [[1000, 450], [390, 844]]) {
  const center = mercator(40.4173, -3.7042);
  const position = mercator(40.4168, -3.7038);
  const units = metersPerPixel(zoom) / reference.scale;
  const camera = new THREE.OrthographicCamera(-width * units / 2, width * units / 2, height * units / 2, -height * units / 2, 0.1, 2000);
  camera.position.set((center.x - reference.x) / reference.scale, (center.y - reference.y) / reference.scale, 1000);
  camera.updateMatrixWorld();
  const point = new THREE.Vector3((position.x - reference.x) / reference.scale, (position.y - reference.y) / reference.scale, 2).project(camera);
  const expected = leaflet(40.4168, -3.7038, zoom), origin = leaflet(40.4173, -3.7042, zoom);
  near((point.x + 1) * width / 2, width / 2 + expected.x - origin.x, 'East/west alignment');
  near((1 - point.y) * height / 2, height / 2 + expected.y - origin.y, 'North/south alignment');
}
for (const [azimuth, x, y] of [[0, 0, -10], [90, -10, 0], [180, 0, 10], [270, 10, 0]]) {
  const point = new THREE.Vector3(0, 0, 10).applyMatrix4(getShadowCastMatrix(azimuth, 45, 1));
  near(point.x, x, 'Shadow direction east');
  near(point.y, y, 'Shadow direction north');
}
const zenith = new THREE.Vector3(3, 4, 10).applyMatrix4(getShadowCastMatrix(90, 90, 1));
near(zenith.x, 3, 'No displacement at zenith');
near(zenith.y, 4, 'No displacement at zenith');
const first = shadowShaderMaterialDefault(0, 45, 1), second = shadowShaderMaterialDefault(90, 45, 1);
first.uniforms.shadowColor.value.w = 0;
near(second.uniforms.shadowColor.value.w, 0.5, 'Independent material uniforms');
first.dispose(); second.dispose();
console.log('Shadow map checks passed: Leaflet alignment, pan, zoom, aspect ratios, solar directions, zenith and independent uniforms.');
