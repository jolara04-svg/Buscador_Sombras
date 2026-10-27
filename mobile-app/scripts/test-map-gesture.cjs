const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.resolve(__dirname, '../src/components/map-gesture.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const bindings = {};
new Function('exports', compiled)(bindings);
const { getMapGesture } = bindings;
const finger = (id, x, y) => ({ id, x, y });
const start = [finger(1, 100, 100), finger(2, 200, 100)];
assert.deepEqual(getMapGesture(start, [finger(1, 120, 140), finger(2, 220, 140)]),
  { dx: 20, dy: 40, zoom: 1, twoFingers: true }, 'Parallel two-finger drag tilts without zooming');
assert.deepEqual(getMapGesture(start, [finger(1, 50, 100), finger(2, 250, 100)]),
  { dx: 0, dy: 0, zoom: 0.5, twoFingers: true }, 'Symmetric pinch zooms without tilting');
assert.deepEqual(getMapGesture(start, [finger(2, 200, 100), finger(1, 100, 100)]),
  { dx: 0, dy: 0, zoom: 1, twoFingers: true }, 'Touch ordering cannot change the gesture');
assert.equal(getMapGesture(start.slice(0, 1), start), null, 'Adding a finger rebases without jumping');
assert.equal(getMapGesture(start, start.slice(0, 1)), null, 'Lifting a finger rebases without jumping');
assert.equal(getMapGesture(start, []), null, 'Cancellation has no camera motion');
assert.equal(getMapGesture(start, [finger(3, 100, 100), finger(4, 200, 100)]), null);
assert.equal(getMapGesture([finger(1, 0, 0), finger(2, 0, 0)], start).zoom, 1, 'Coincident fingers cannot create invalid zoom');
assert.deepEqual(getMapGesture([finger(1, 100, 100)], [finger(1, 105, 120)]),
  { dx: 5, dy: 20, zoom: 1, twoFingers: false });
console.log('Gesture checks passed: tilt, pinch, touch ordering, transitions, cancellation, degenerate spans and single-finger drag.');
