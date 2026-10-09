'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const express = require('express');

const DATASET_ID = 'madrid_chunks';
const DATASET_ZOOM = 16;
const TILE_MIME = 'model/gltf-binary';
const INTEGER_PATTERN = /^(0|[1-9]\d*)$/;

function getDefaultDatasetRoot() {
  return path.resolve(__dirname, '..', 'madrid_chunks', 'madrid_chunks');
}

function getDatasetRoot(value = process.env.MADRID_CHUNKS_DIR) {
  return path.resolve(value || getDefaultDatasetRoot());
}

function parseCoordinate(value, name) {
  if (typeof value !== 'string' || !INTEGER_PATTERN.test(value)) {
    const error = new Error(`${name} must be a non-negative decimal integer`);
    error.code = 'INVALID_COORDINATE';
    throw error;
  }

  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    const error = new Error(`${name} is outside the supported range`);
    error.code = 'INVALID_COORDINATE';
    throw error;
  }

  return number;
}

function validateManifest(manifest) {
  if (!manifest || Array.isArray(manifest) || typeof manifest !== 'object') {
    throw new Error('manifest.json must contain an object');
  }

  const tiles = new Set();
  const normalizedManifest = {};
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const [xText, yValues] of Object.entries(manifest)) {
    const x = parseCoordinate(xText, 'x');
    if (!Array.isArray(yValues)) {
      throw new Error(`manifest entry ${xText} must contain an array`);
    }

    const normalizedYValues = [];
    for (const yText of yValues) {
      if (typeof yText !== 'string') {
        throw new Error(`manifest entry ${xText} contains a non-string y coordinate`);
      }
      const y = parseCoordinate(yText, 'y');
      const tileKey = `${x}/${y}`;
      if (tiles.has(tileKey)) {
        throw new Error(`manifest contains duplicate tile ${tileKey}`);
      }

      tiles.add(tileKey);
      normalizedYValues.push(yText);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    normalizedManifest[xText] = normalizedYValues;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
  }

  return {
    manifest: normalizedManifest,
    tiles,
    metadata: {
      id: DATASET_ID,
      zoom: DATASET_ZOOM,
      format: 'glb',
      mimeType: TILE_MIME,
      tileCount: tiles.size,
      xRange: Number.isFinite(minX) ? [minX, maxX] : [],
      yRange: Number.isFinite(minY) ? [minY, maxY] : [],
      attribution: 'Ayuntamiento de Madrid — Geoportal',
      tileUrlTemplate: `/api/${DATASET_ID}/{z}/{x}/{y}.glb`,
    },
  };
}

function loadDataset(datasetRoot = getDatasetRoot()) {
  const root = path.resolve(datasetRoot);
  const rootStats = fs.statSync(root, { throwIfNoEntry: false });
  if (!rootStats || !rootStats.isDirectory()) {
    throw new Error(`Dataset directory does not exist: ${root}`);
  }

  const manifestPath = path.join(root, 'manifest.json');
  let manifestText;
  let manifest;
  try {
    manifestText = fs.readFileSync(manifestPath, 'utf8');
    manifest = JSON.parse(manifestText);
  } catch (error) {
    throw new Error(`Unable to read dataset manifest: ${error.message}`);
  }

  const validated = validateManifest(manifest);
  const realRoot = fs.realpathSync(root);

  return {
    root,
    realRoot,
    manifest: validated.manifest,
    manifestText,
    metadata: validated.metadata,
    tiles: validated.tiles,
  };
}

function isInsideDirectory(root, candidate) {
  const relativePath = path.relative(root, candidate);
  return relativePath !== '' && relativePath !== '..' && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath);
}

function getTilePath(dataset, zText, xText, yText) {
  let z;
  let x;
  let y;
  try {
    z = parseCoordinate(zText, 'z');
    x = parseCoordinate(xText, 'x');
    y = parseCoordinate(yText, 'y');
  } catch (error) {
    return { error };
  }

  if (z !== dataset.metadata.zoom || !dataset.tiles.has(`${x}/${y}`)) {
    return { missing: true };
  }

  const candidate = path.resolve(dataset.root, String(z), String(x), `${y}.glb`);
  if (!isInsideDirectory(dataset.root, candidate)) {
    const error = new Error('Tile path is outside the dataset directory');
    error.code = 'INVALID_TILE_PATH';
    return { error };
  }

  if (fs.existsSync(candidate)) {
    try {
      const realCandidate = fs.realpathSync(candidate);
      if (!isInsideDirectory(dataset.realRoot, realCandidate)) {
        const error = new Error('Tile path is outside the dataset directory');
        error.code = 'INVALID_TILE_PATH';
        return { error };
      }
    } catch (error) {
      return { error };
    }
  }

  return { path: candidate };
}

function parseCorsOrigins(value = process.env.CORS_ORIGIN) {
  if (!value || value.trim() === '*') return ['*'];
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function addCorsHeaders(req, res, origins) {
  const requestOrigin = req.get('Origin');
  if (origins.includes('*')) {
    res.set('Access-Control-Allow-Origin', '*');
  } else if (requestOrigin && origins.includes(requestOrigin)) {
    res.set('Access-Control-Allow-Origin', requestOrigin);
    res.set('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Accept, Content-Type, Range');
    res.status(204).end();
    return false;
  }

  return true;
}

function sendError(res, status, code, message) {
  if (res.headersSent) return;
  res.status(status).json({
    error: {
      code,
      message,
    },
  });
}

function createApp(options = {}) {
  const dataset = options.dataset || loadDataset(options.datasetRoot);
  const origins = options.corsOrigins || parseCorsOrigins(options.corsOrigin);
  const app = express();

  app.disable('x-powered-by');
  app.use((req, res, next) => {
    if (addCorsHeaders(req, res, origins)) next();
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get(`/api/${DATASET_ID}`, (req, res) => {
    res.json(dataset.metadata);
  });

  app.get(`/api/${DATASET_ID}/manifest`, (req, res) => {
    res.type('application/json; charset=utf-8');
    res.set('Cache-Control', 'no-cache');
    res.send(dataset.manifestText);
  });

  app.get(`/api/${DATASET_ID}/:z/:x/:y.glb`, (req, res) => {
    const tile = getTilePath(dataset, req.params.z, req.params.x, req.params.y);
    if (tile.error) {
      const status = tile.error.code === 'INVALID_TILE_PATH' ? 500 : 400;
      sendError(res, status, tile.error.code, 'Invalid tile coordinates');
      return;
    }
    if (tile.missing) {
      sendError(res, 404, 'TILE_NOT_FOUND', 'Tile is not available');
      return;
    }

    res.set('Content-Type', TILE_MIME);
    res.set('Cache-Control', 'public, max-age=86400');
    res.sendFile(tile.path, (error) => {
      if (!error || res.headersSent) return;
      if (error.status === 404) {
        sendError(res, 404, 'TILE_NOT_FOUND', 'Tile is not available');
        return;
      }
      sendError(res, 500, 'TILE_READ_ERROR', 'Unable to read tile');
    });
  });

  app.use((req, res) => {
    sendError(res, 404, 'NOT_FOUND', 'Route not found');
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
  });

  return app;
}

function parsePort(value = process.env.PORT || '3000') {
  if (!/^\d+$/.test(String(value))) throw new Error('PORT must be a valid number');
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT must be between 0 and 65535');
  }
  return port;
}

function startServer(options = {}) {
  const host = options.host || process.env.HOST || '127.0.0.1';
  const port = options.port === undefined ? parsePort() : parsePort(options.port);
  const app = options.app || createApp(options);
  const server = http.createServer(app);

  server.requestTimeout = 120_000;
  server.headersTimeout = 15_000;
  server.keepAliveTimeout = 5_000;

  server.listen(port, host, () => {
    const address = server.address();
    const actualPort = address && typeof address === 'object' ? address.port : port;
    console.log(`Madrid chunks server listening on http://${host}:${actualPort}`);
  });

  return server;
}

if (require.main === module) {
  try {
    startServer();
  } catch (error) {
    console.error(`Unable to start Madrid chunks server: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  DATASET_ID,
  DATASET_ZOOM,
  TILE_MIME,
  createApp,
  getDatasetRoot,
  loadDataset,
  parseCoordinate,
  startServer,
  validateManifest,
};
