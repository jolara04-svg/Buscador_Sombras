'use strict';

const { test } = require('node:test');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const THREE = require('three');
const { GLTFLoader } = require('three/examples/jsm/loaders/GLTFLoader.js');

const filename = path.resolve(__dirname, '..', 'src', 'components', 'chunk-stream.ts');
const compiled = new Module(filename, module);
compiled.filename = filename;
compiled.paths = module.paths;
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { ChunkStream, getChunkMarkerKey } = compiled.exports;

test('ChunkStream genera claves de marcador únicas entre capas', () => {
  assert.notEqual(
    getChunkMarkerKey({ key: '32096/24711', layer: 'buildings' }),
    getChunkMarkerKey({ key: '32096/24711', layer: 'trees' }),
  );
  assert.equal(getChunkMarkerKey({ key: '32096/24711' }), 'buildings:32096/24711');
});

test('ChunkStream loads neighbours, deduplicates, evicts and aborts', async () => {
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
    if (url.includes('/manifest/')) return { ok: false };
    if (!initialized) {
      initialized = true;
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) };
    }
    return new Promise((resolve, reject) => {
      pending.push({ url, signal: options.signal, resolve });
      options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
  };
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  async function drain() {
    for (let i = 0; i < 30 && pending.length; i += 1) {
      const batch = pending;
      pending = [];
      batch.forEach(({ resolve }) => resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }));
      await tick();
    }
  }

  let changes = 0;
  const stream = new ChunkStream('http://localhost:3000/chunk?lat=40.4168&lon=-3.7038', () => changes += 1);
  try {
    await stream.initialize();
    assert.ok(stream.tileSize > 450 && stream.tileSize < 480);
    stream.update(new THREE.Vector3(), 100, 1);
    assert.equal(pending.length, 3);
    assert.equal(stream.markers.length, 3);
    stream.update(new THREE.Vector3(), 100, 1);
    assert.equal(pending.length, 3);
    await drain();
    assert.equal(stream.root.children.length, 9);
    assert.equal(stream.markers.length, 0);
    const count = requests.length;
    stream.update(new THREE.Vector3(), 100, 1);
    assert.equal(requests.length, count);
    stream.update(new THREE.Vector3(stream.tileSize * 10, 0, 0), 100, 1);
    assert.equal(stream.root.children.length, 0);
    const outstanding = [...pending];
    stream.dispose();
    assert.ok(outstanding.every(({ signal }) => signal.aborted));
    await drain();
    assert.equal(stream.root.children.length, 0);
    assert.ok(changes >= 8);
  } finally {
    stream.dispose();
    global.fetch = originalFetch;
    GLTFLoader.prototype.parse = originalParse;
  }
});

test('ChunkStream obtiene árboles por la capa separada y permite ocultarla', async () => {
  const originalFetch = global.fetch;
  const originalParse = GLTFLoader.prototype.parse;
  const requests = [];
  GLTFLoader.prototype.parse = function (_data, _url, resolve) {
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial()));
    resolve({ scene });
  };
  global.fetch = async (url) => {
    requests.push(String(url));
    if (String(url).includes('/manifest/')) return { ok: false };
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) };
  };
  const stream = new ChunkStream('http://localhost:3000/chunk?lat=40.4168&lon=-3.7038', () => {}, { layers: ['buildings', 'trees'] });
  try {
    await stream.initialize();
    assert.ok(requests.some(url => url.includes('/tiles/buildings/16/')));
    assert.ok(requests.some(url => url.includes('/tiles/trees/16/')));
    assert.equal(stream.isLayerEnabled('trees'), true);
    stream.setLayerEnabled('trees', false);
    assert.equal(stream.isLayerEnabled('trees'), false);
    assert.equal(stream.roots.trees.parent, null);
  } finally {
    stream.dispose();
    global.fetch = originalFetch;
    GLTFLoader.prototype.parse = originalParse;
  }
});
