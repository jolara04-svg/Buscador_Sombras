const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const manifest = require('./madrid_chunks/manifest.json');

const app = express();
const PORT = 3000;
const ZOOM = 16;



//Linea necesaria para usar desde web por seguridad en browsers.
app.use(cors());

/**
 * Convierte Latitud y Longitud a coordenadas de tesela (X, Y) para Web Mercator.
 * zoom 16 convierte divide la tierra en un tablero de  2^16 x 2^16 chunks.
 * con slippy la tierra se proyecta en un cilindro, por eso se achican los chunks cuanto mas lejos del ecuador.
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



// comprueba si tenemos ese chunk en coordenadas Mercator.
function chunkExiste(x, y) {
  const ys = manifest[String(x)];
  return ys ? ys.includes(String(y)) : false;
}

// mandar el manifest a la app.
app.get('/manifest', (req, res) => {
  res.json(manifest);
});

// -------------------------------------------------------------
// Endpoint principal: Obtener chunk por Latitud y Longitud
// coordenadas son grados en decimales.
// Ejemplo: GET /chunk?lat=40.4168&lon=-3.7038
// -------------------------------------------------------------
app.get('/chunk', (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'Debes pasar "lat" y "lon" numéricos como query params.' });
  }

  // 1. Calculamos X e Y
  const { x, y, z } = latLonToTile(lat, lon, ZOOM);


  // 2. Comprobamos si el chunk existe
  if (!chunkExiste(x, y)) {
    return res.status(404).json({
      error: 'Sin edificios 3D en esta zona.',
      tile: { z, x, y }
    });
  }

  // 3. Ruta al archivo .glb
  const filePath = path.join(__dirname, 'madrid_chunks', String(z), String(x), `${y}.glb`);

  // 4. Enviamos el archivo con la cabecera MIME correcta para glTF binario
  res.setHeader('Content-Type', 'model/gltf-binary');
  res.sendFile(filePath);
});

// -------------------------------------------------------------
// Endpoint directamente coordenadas de Mercator (tal cual x e y de madrid chunks):
// Ejemplo: GET /tiles/16/32090/24720.glb
// -------------------------------------------------------------
app.get('/tiles/:z/:x/:y.glb', (req, res) => {
  const { z, x, y } = req.params;
  
  if (Number(z) !== ZOOM || !chunkExiste(x, y)) {
    return res.status(404).send('Not Found');
  }

  const filePath = path.join(__dirname, 'madrid_chunks', z, x, `${y}.glb`);

  res.setHeader('Content-Type', 'model/gltf-binary');
  res.sendFile(filePath);
});

app.listen(PORT, () => {
  console.log(` Servidor 3D de Madrid corriendo en http://localhost:${PORT}`);
  console.log(` Prueba puerta del sol en: http://localhost:${PORT}/chunk?lat=40.4168&lon=-3.7038`);
});