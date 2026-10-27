const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const THREE = require('three');
const { GLTFLoader } = require('three/examples/jsm/loaders/GLTFLoader.js');

const filename = path.resolve(__dirname, '../src/components/chunk-stream.ts');
const compiled = new Module(filename, module);
compiled.filename = filename;
compiled.paths = module.paths;
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { ChunkStream } = compiled.exports;

const originalFetch = global.fetch;
const originalParse = GLTFLoader.prototype.parse;
const requests = [];
let pending = [];
let initialized = false;
GLTFLoader.prototype.parse = function (_data, _url, resolve) {
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(400, 400, 30), new THREE.MeshBasicMaterial()));
  resolve({ scene });
};
global.fetch = async (url, options) => {
  requests.push(url);
  if (url.endsWith('/manifest')) return { ok: false };
  if (!initialized) { initialized = true; return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) }; }
  return new Promise((resolve, reject) => {
    const request = { url, signal: options.signal, resolve };
    pending.push(request);
    options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
};
const tick = () => new Promise((resolve) => setImmediate(resolve));
async function drain() {
  for (let i = 0; i < 30 && pending.length; i++) {
    const batch = pending;
    pending = [];
    batch.forEach(({ resolve }) => resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }));
    await tick();
  }
}

(async () => {
  let changes = 0;
  const stream = new ChunkStream('http://localhost:3000/chunk?lat=40.4168&lon=-3.7038', () => changes++);
  try {
    await stream.initialize();
    assert.ok(stream.tileSize > 450 && stream.tileSize < 480);
    stream.update(new THREE.Vector3(), 100, 1);
    assert.equal(pending.length, 3, 'At most three neighbours load concurrently');
    assert.equal(stream.markers.length, 3, 'Loading markers exist before responses arrive');
    stream.update(new THREE.Vector3(), 100, 1);
    assert.equal(pending.length, 3, 'Repeated frames do not duplicate pending requests');
    await drain();
    assert.equal(stream.root.children.length, 9, 'The centre and eight neighbours coexist');
    assert.equal(stream.markers.length, 0);
    assert.ok(stream.root.children.some((model) => Math.abs(model.position.x - stream.tileSize) < 0.001));
    const count = requests.length;
    stream.update(new THREE.Vector3(), 100, 1);
    assert.equal(requests.length, count, 'Loaded tiles are reused');
    stream.update(new THREE.Vector3(stream.tileSize * 10, 0, 0), 100, 1);
    assert.equal(stream.root.children.length, 0, 'Distant geometry is evicted');
    const outstanding = [...pending];
    stream.dispose();
    assert.ok(outstanding.every(({ signal }) => signal.aborted), 'Disposal aborts in-flight fetches');
    await drain();
    assert.equal(stream.root.children.length, 0, 'Late responses cannot restore disposed geometry');
    assert.ok(changes >= 8);
    console.log('Chunk streaming checks passed: neighbours, placement, concurrency, deduplication, eviction, cancellation.');
  } finally {
    stream.dispose();
    global.fetch = originalFetch;
    GLTFLoader.prototype.parse = originalParse;
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
