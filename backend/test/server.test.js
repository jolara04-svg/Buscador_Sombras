const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { after, before, describe, it } = require('node:test');

const backendDir = path.resolve(__dirname, '..');
const manifest = require(path.join(backendDir, 'madrid_chunks', 'manifest.json'));
const treesManifest = require(path.join(backendDir, 'madrid_trees', 'manifest.json'));
const places = require(path.join(backendDir, 'places.json'));
const port = 31000 + (process.pid % 1000);
const baseUrl = `http://127.0.0.1:${port}`;

function tileToLatLon(x, y, z = 16) {
  const n = 2 ** z;
  const lon = ((x + 0.5) / n) * 360 - 180;
  const mercator = Math.PI * (1 - (2 * (y + 0.5)) / n);
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(mercator));
  return { lat, lon };
}

function firstRealChunk() {
  for (const [x, ys] of Object.entries(manifest)) {
    for (const y of ys) {
      const file = path.join(backendDir, 'madrid_chunks', '16', x, `${y}.glb`);
      if (fs.existsSync(file)) return { x, y, file };
    }
  }
  throw new Error('No se encontró un chunk .glb listado en manifest.json');
}

function firstRealTreeChunk() {
  for (const [x, ys] of Object.entries(treesManifest)) {
    for (const y of ys) {
      const file = path.join(backendDir, 'madrid_trees', '16', x, `${y}.glb`);
      if (fs.existsSync(file)) return { x, y, file };
    }
  }
  throw new Error('No se encontró un chunk de árboles listado en manifest.json');
}

async function waitForServer() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/manifest`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('El servidor no respondió a tiempo');
}

let server;
before(async () => {
  server = spawn(process.execPath, ['test/server-launcher.js'], {
    cwd: backendDir,
    env: { ...process.env, TEST_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await waitForServer();
});

after(async () => {
  if (!server || server.exitCode !== null) return;
  server.kill('SIGTERM');
  await new Promise(resolve => {
    const timer = setTimeout(() => { server.kill('SIGKILL'); resolve(); }, 2000);
    server.once('exit', () => { clearTimeout(timer); resolve(); });
  });
});

async function request(route) {
  return fetch(`${baseUrl}${route}`);
}

describe('API backend', () => {
  it('devuelve el manifest publicado', async () => {
    const response = await request('/manifest');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), manifest);
  });

  it('publica el manifest de árboles por capa', async () => {
    const response = await request('/manifest/trees');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), treesManifest);
  });

  it('rechaza capas desconocidas', async () => {
    const manifestResponse = await request('/manifest/roads');
    assert.equal(manifestResponse.status, 400);
    assert.match((await manifestResponse.json()).error, /buildings.*trees/i);

    const tileResponse = await request('/tiles/roads/16/32069/24696.glb');
    assert.equal(tileResponse.status, 400);
  });

  it('valida latitud y longitud en /chunk', async () => {
    const response = await request('/chunk?lat=no&lon=-3.7');
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /lat.*lon.*numéricos/i);
  });

  it('devuelve 404 con coordenadas sin chunk', async () => {
    const response = await request('/chunk?lat=0&lon=0');
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.equal(body.error, 'Sin edificios 3D en esta zona.');
    assert.equal(body.tile.z, 16);
  });

  it('devuelve resultados para una búsqueda vacía y una búsqueda real', async () => {
    const empty = await request('/api/search?q=%20%20');
    assert.equal(empty.status, 200);
    assert.deepEqual(await empty.json(), []);

    const expected = places.find(place => place.nombre === 'Retiro');
    assert.ok(expected, 'Debe existir Retiro en places.json');
    const real = await request('/api/search?q=Retiro');
    assert.equal(real.status, 200);
    const results = await real.json();
    assert.ok(results.some(place => place.id === expected.id));
    assert.ok(results.length <= 10);
  });

  it('sirve un tile válido con MIME glTF binario', async () => {
    const chunk = firstRealChunk();
    const response = await request(`/tiles/16/${chunk.x}/${chunk.y}.glb`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'model/gltf-binary');
    assert.ok((await response.arrayBuffer()).byteLength > 0);
  });

  it('sirve un tile válido de árboles por capa', async () => {
    const chunk = firstRealTreeChunk();
    const response = await request(`/tiles/trees/16/${chunk.x}/${chunk.y}.glb`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'model/gltf-binary');
    assert.ok((await response.arrayBuffer()).byteLength > 0);
  });

  it('no permite traversal en rutas de tiles', async () => {
    const response = await request('/tiles/trees/16/../package.json.glb');
    assert.notEqual(response.status, 200);
  });

  it('devuelve 404 para un tile inexistente', async () => {
    const response = await request('/tiles/15/0/0.glb');
    assert.equal(response.status, 404);
  });

  it('sirve un /chunk válido a partir de un tile real del manifest', async () => {
    const chunk = firstRealChunk();
    const { lat, lon } = tileToLatLon(Number(chunk.x), Number(chunk.y));
    const response = await request(`/chunk?lat=${lat}&lon=${lon}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'model/gltf-binary');
    assert.ok((await response.arrayBuffer()).byteLength > 0);
  });
  it('sirve un /chunk válido de árboles a partir de un tile real del manifest', async () => {
    const chunk = firstRealTreeChunk();
    const { lat, lon } = tileToLatLon(Number(chunk.x), Number(chunk.y));
    const response = await request(`/chunk?layer=trees&lat=${lat}&lon=${lon}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'model/gltf-binary');
    assert.ok((await response.arrayBuffer()).byteLength > 0);
  });

  it('sirve el endpoint directo de tiles de árboles', async () => {
    const chunk = firstRealTreeChunk();
    const response = await request(`/tiles/trees/16/${chunk.x}/${chunk.y}.glb`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'model/gltf-binary');
  });

  it('mantiene manifiestos de edificios y árboles con coordenadas válidas', async () => {
    for (const [name, value] of [['buildings', manifest], ['trees', treesManifest]]) {
      assert.ok(Object.keys(value).length > 0, `${name} debe tener cobertura`);
      for (const [x, ys] of Object.entries(value)) {
        assert.match(x, /^\d+$/);
        assert.ok(Array.isArray(ys) && ys.length > 0);
        ys.forEach(y => assert.match(y, /^\d+$/));
      }
    }
  });
});
