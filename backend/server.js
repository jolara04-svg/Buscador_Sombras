const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const Fuse = require('fuse.js');

const manifests = {
  buildings: require('./madrid_chunks/manifest.json'),
  trees: require('./madrid_trees/manifest.json'),
};
const layerDirectories = {
  buildings: 'madrid_chunks',
  trees: 'madrid_trees',
};
const layerNames = {
  buildings: 'edificios',
  trees: 'árboles',
};

const app = express();
const PORT = 3000;
const ZOOM = 16;

// Línea necesaria para usar desde web por seguridad en browsers.
app.use(cors());

// -------------------------------------------------------------
// Carga de datos y configuración de Fuse.js para el buscador
// -------------------------------------------------------------
let placesData = [];
const placesFilePath = path.join(__dirname, 'places.json');

try {
  if (fs.existsSync(placesFilePath)) {
    const rawData = fs.readFileSync(placesFilePath, 'utf8');
    placesData = JSON.parse(rawData);
    console.log(`[Buscador] Cargados ${placesData.length} lugares en memoria correctamente.`);
  } else {
    console.warn(`[Buscador] Advertencia: No se encontró places.json en ${placesFilePath}. Ejecuta "node extract-places.js".`);
  }
} catch (err) {
  console.error('[Buscador] Error al cargar places.json:', err.message);
}

const fuseOptions = {
  keys: ['nombre'],
  threshold: 0.3,         // Tolerancia a errores tipográficos (fuzzy search)
  distance: 100,
  ignoreLocation: true,   // Buscar en cualquier parte del nombre
  includeScore: true,
};

const fuse = new Fuse(placesData, fuseOptions);

/**
 * Convierte Latitud y Longitud a coordenadas de tesela (X, Y) para Web Mercator.
 * zoom 16 divide la tierra en un tablero de 2^16 x 2^16 chunks.
 */
function latLonToTile(lat, lon, zoom = 16) {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lon + 180) / 360) * n);
  
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );

  return { x, y, z: zoom };
}

// Comprueba si tenemos ese chunk en coordenadas Mercator.
function getLayer(layer) {
  return typeof layer === 'string' && Object.prototype.hasOwnProperty.call(manifests, layer)
    ? layer
    : null;
}

function isTileCoordinate(value) {
  return /^\d+$/.test(value);
}

function chunkExiste(layer, x, y) {
  const layerManifest = manifests[layer];
  const ys = layerManifest[String(x)];
  return ys ? ys.includes(String(y)) : false;
}

function chunkPath(layer, z, x, y) {
  return path.join(__dirname, layerDirectories[layer], String(z), String(x), `${y}.glb`);
}

function sendChunk(req, res, layer, z, x, y) {
  if (!getLayer(layer)) {
    return res.status(400).json({ error: 'La capa debe ser "buildings" o "trees".' });
  }
  if (Number(z) !== ZOOM || !isTileCoordinate(x) || !isTileCoordinate(y) || !chunkExiste(layer, x, y)) {
    return res.status(404).json({ error: `No existe ese chunk de ${layer}.` });
  }

  res.setHeader('Content-Type', 'model/gltf-binary');
  return res.sendFile(chunkPath(layer, z, x, y));
}

// Endpoint para obtener el manifest
app.get('/manifest', (req, res) => {
  res.json(manifests.buildings);
});

app.get('/manifest/:layer', (req, res) => {
  const layer = getLayer(req.params.layer);
  if (!layer) {
    return res.status(400).json({ error: 'La capa debe ser "buildings" o "trees".' });
  }
  return res.json(manifests[layer]);
});

// -------------------------------------------------------------
// Endpoint de Búsqueda: GET /api/search?q=...
// Devuelve hasta 10 resultados ordenados por relevancia usando Fuse.js
// -------------------------------------------------------------
app.get('/api/search', (req, res) => {
  const query = req.query.q;
  if (!query || typeof query !== 'string' || query.trim() === '') {
    return res.json([]);
  }

  const searchTerm = query.trim();
  const searchResults = fuse.search(searchTerm);

  // Limitar al top 10 y extraer el objeto original
  const topResults = searchResults.slice(0, 10).map(result => result.item);

  res.json(topResults);
});

// -------------------------------------------------------------
// Endpoint principal: Obtener chunk por Latitud y Longitud
// Ejemplo: GET /chunk?lat=40.4168&lon=-3.7038
// -------------------------------------------------------------
app.get('/chunk', (req, res) => {
  const layer = req.query.layer || 'buildings';
  if (!getLayer(layer)) {
    return res.status(400).json({ error: 'La capa debe ser "buildings" o "trees".' });
  }
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'Debes pasar "lat" y "lon" numéricos como query params.' });
  }

  // 1. Calculamos X e Y
  const { x, y, z } = latLonToTile(lat, lon, ZOOM);

  // 2. Comprobamos si el chunk existe
  if (!chunkExiste(layer, x, y)) {
    return res.status(404).json({
      error: `Sin ${layerNames[layer]} 3D en esta zona.`,
      tile: { z, x, y }
    });
  }

  // 3. Ruta al archivo .glb
  return sendChunk(req, res, layer, z, x, y);
});

// -------------------------------------------------------------
// Endpoint directamente coordenadas de Mercator
// Ejemplo: GET /tiles/16/32090/24720.glb
// -------------------------------------------------------------
app.get('/tiles/:z/:x/:y.glb', (req, res) => {
  const { z, x, y } = req.params;
  return sendChunk(req, res, 'buildings', z, x, y);
});

app.get('/tiles/:layer/:z/:x/:y.glb', (req, res) => {
  const { layer, z, x, y } = req.params;
  return sendChunk(req, res, layer, z, x, y);
});

app.listen(PORT, () => {
  console.log(` Servidor 3D de Madrid corriendo en http://localhost:${PORT}`);
  console.log(` Búsqueda disponible en: http://localhost:${PORT}/api/search?q=gran+via`);
});
