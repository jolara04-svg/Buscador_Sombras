'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createApp } = require('../index');

const TILE_BYTES = Buffer.from('glTF\x02\x00\x00\x00fixture');

async function createFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'madrid-chunks-'));
  await fs.mkdir(path.join(root, '16', '10'), { recursive: true });
  await fs.writeFile(path.join(root, 'manifest.json'), '{"10":["20","21"]}');
  await fs.writeFile(path.join(root, '16', '10', '20.glb'), TILE_BYTES);
  return root;
}

async function startFixtureServer(root) {
  const app = createApp({
    datasetRoot: root,
    corsOrigin: 'https://allowed.example',
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

test('serves health and dataset metadata', async (t) => {
  const root = await createFixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const server = await startFixtureServer(root);
  t.after(server.close);

  const healthResponse = await fetch(`${server.baseUrl}/health`);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), { status: 'ok' });

  const metadataResponse = await fetch(`${server.baseUrl}/api/madrid_chunks`);
  assert.equal(metadataResponse.status, 200);
  const metadata = await metadataResponse.json();
  assert.equal(metadata.zoom, 16);
  assert.equal(metadata.tileCount, 2);
  assert.deepEqual(metadata.xRange, [10, 10]);
  assert.deepEqual(metadata.yRange, [20, 21]);
});

test('returns the manifest without exposing the filesystem', async (t) => {
  const root = await createFixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const server = await startFixtureServer(root);
  t.after(server.close);

  const response = await fetch(`${server.baseUrl}/api/madrid_chunks/manifest`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^application\/json/);
  assert.deepEqual(await response.json(), { 10: ['20', '21'] });

  const readmeResponse = await fetch(`${server.baseUrl}/api/madrid_chunks/README_MUY_CLUTCH.md`);
  assert.equal(readmeResponse.status, 404);
});

test('streams a known GLB with the correct MIME type and supports HEAD', async (t) => {
  const root = await createFixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const server = await startFixtureServer(root);
  t.after(server.close);

  const url = `${server.baseUrl}/api/madrid_chunks/16/10/20.glb`;
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'model/gltf-binary');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), TILE_BYTES);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=86400');

  const headResponse = await fetch(url, { method: 'HEAD' });
  assert.equal(headResponse.status, 200);
  assert.equal(headResponse.headers.get('content-length'), String(TILE_BYTES.length));
  assert.equal(await headResponse.text(), '');
});

test('rejects invalid, unavailable, and traversal-like tile paths', async (t) => {
  const root = await createFixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const server = await startFixtureServer(root);
  t.after(server.close);

  const invalidResponse = await fetch(`${server.baseUrl}/api/madrid_chunks/16/not-a-number/20.glb`);
  assert.equal(invalidResponse.status, 400);
  assert.equal((await invalidResponse.json()).error.code, 'INVALID_COORDINATE');

  const missingResponse = await fetch(`${server.baseUrl}/api/madrid_chunks/16/10/99.glb`);
  assert.equal(missingResponse.status, 404);
  assert.equal((await missingResponse.json()).error.code, 'TILE_NOT_FOUND');

  const wrongZoomResponse = await fetch(`${server.baseUrl}/api/madrid_chunks/15/10/20.glb`);
  assert.equal(wrongZoomResponse.status, 404);

  const traversalResponse = await fetch(`${server.baseUrl}/api/madrid_chunks/16/10/%2e%2e.glb`);
  assert.notEqual(traversalResponse.status, 200);
});

test('applies the configured CORS allowlist', async (t) => {
  const root = await createFixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const server = await startFixtureServer(root);
  t.after(server.close);

  const allowed = await fetch(`${server.baseUrl}/health`, {
    headers: { Origin: 'https://allowed.example' },
  });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://allowed.example');

  const denied = await fetch(`${server.baseUrl}/health`, {
    headers: { Origin: 'https://denied.example' },
  });
  assert.equal(denied.headers.get('access-control-allow-origin'), null);

  const preflight = await fetch(`${server.baseUrl}/api/madrid_chunks/16/10/20.glb`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://allowed.example',
      'Access-Control-Request-Method': 'GET',
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-methods'), 'GET, HEAD, OPTIONS');
});

test('fails fast when the dataset root is missing', () => {
  assert.throws(
    () => createApp({ datasetRoot: path.join(os.tmpdir(), 'does-not-exist-madrid-chunks') }),
    /Dataset directory does not exist/,
  );
});
