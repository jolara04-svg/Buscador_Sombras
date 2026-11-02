'use strict';

const { test } = require('node:test');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTypeScript(relativePath) {
  const filename = path.resolve(__dirname, '..', 'src', 'components', relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function('exports', 'require', compiled)(exports, require);
  return exports;
}

const { getMapGesture } = loadTypeScript('map-gesture.ts');
const finger = (id, x, y) => ({ id, x, y });

test('map gesture preserves translation for a two-finger drag', () => {
  assert.deepEqual(getMapGesture(
    [finger(1, 100, 100), finger(2, 200, 100)],
    [finger(1, 120, 140), finger(2, 220, 140)],
  ), { dx: 20, dy: 40, zoom: 1, twoFingers: true });
});

test('map gesture reports pinch scale and ignores touch array order', () => {
  const start = [finger(1, 100, 100), finger(2, 200, 100)];
  assert.deepEqual(getMapGesture(start, [finger(1, 50, 100), finger(2, 250, 100)]),
    { dx: 0, dy: 0, zoom: 0.5, twoFingers: true });
  assert.deepEqual(getMapGesture(start, [finger(2, 200, 100), finger(1, 100, 100)]),
    { dx: 0, dy: 0, zoom: 1, twoFingers: true });
});

test('map gesture rebases contact changes and cancellation', () => {
  const start = [finger(1, 100, 100), finger(2, 200, 100)];
  assert.equal(getMapGesture([finger(1, 100, 100)], start), null);
  assert.equal(getMapGesture(start, start.slice(0, 1)), null);
  assert.equal(getMapGesture(start, []), null);
  assert.equal(getMapGesture(start, [finger(3, 100, 100), finger(4, 200, 100)]), null);
});

test('map gesture handles one finger and zero-length spans safely', () => {
  assert.deepEqual(getMapGesture([finger(1, 100, 100)], [finger(1, 105, 120)]),
    { dx: 5, dy: 20, zoom: 1, twoFingers: false });
  assert.equal(getMapGesture([finger(1, 0, 0), finger(2, 0, 0)],
    [finger(1, 10, 0), finger(2, 10, 0)]).zoom, 1);
});
