/**
 * Script de extracción de lugares de Madrid desde OpenStreetMap usando Overpass API.
 * Genera un archivo JSON optimizado (`places.json`) para búsquedas rápidas con Fuse.js.
 */

const fs = require('fs');
const path = require('path');

// Consulta Overpass QL para Madrid (calles, plazas, universidades, museos/atracciones, parques y estaciones de transporte)
const OVERPASS_QUERY = `
[out:json][timeout:120];
area["name"="Madrid"]["admin_level"="8"]->.searchArea;

(
  // 1. Calles principales (vías con nombre)
  way["highway"]["name"](area.searchArea);
  
  // 2. Plazas
  node["place"="square"](area.searchArea);
  way["place"="square"](area.searchArea);
  
  // 3. Ciudad Universitaria y edificios universitarios
  node["amenity"="university"](area.searchArea);
  way["amenity"="university"](area.searchArea);
  node["building"="university"](area.searchArea);
  way["building"="university"](area.searchArea);
  
  // 4. Museos y sitios de interés turísticos
  node["tourism"~"museum|attraction"](area.searchArea);
  way["tourism"~"museum|attraction"](area.searchArea);
  
  // 5. Parques grandes
  node["leisure"="park"](area.searchArea);
  way["leisure"="park"](area.searchArea);

  // 6. Estaciones de tren y metro
  node["railway"="station"](area.searchArea);
  way["railway"="station"](area.searchArea);
  node["station"="subway"](area.searchArea);
);

out center;
`;

// Función para determinar un tipo amigable en español basado en las etiquetas OSM
function determinarTipo(tags) {
  if (!tags) return 'Lugar';
  if (tags.highway) return 'Calle';
  if (tags.place === 'square') return 'Plaza';
  if (tags.amenity === 'university' || tags.building === 'university') return 'Universidad';
  if (tags.tourism) return 'Museo / Atracción';
  if (tags.leisure === 'park') return 'Parque';
  if (tags.railway || tags.station === 'subway') return 'Estación de Transporte';
  return 'Lugar';
}

async function extraerLugaresMadrid() {
  console.log('Iniciando petición a Overpass API para el municipio de Madrid...');
  console.log('Esto puede tardar unos segundos debido al volumen de datos (calles, parques, universidades, estaciones)...');

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
        'User-Agent': 'BuscadorSombrasApp/1.0 (contact@buscador-sombras.local)',
      },
      body: OVERPASS_QUERY,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en la API de Overpass (${response.status} ${response.statusText}): ${errorText}`);
    }

    const data = await response.json();

    if (!data.elements || !Array.isArray(data.elements)) {
      throw new Error('La respuesta de Overpass API no contiene un array de elementos válido.');
    }

    console.log(`Se recibieron ${data.elements.length} elementos brutos de OSM. Procesando, filtrando y deduplicando...`);

    const lugaresArray = [];
    const nombresYTiposVistos = new Set(); // Para evitar duplicados por nombre y tipo

    for (const el of data.elements) {
      // Ignorar elementos sin etiquetas o sin nombre registrado
      if (!el.tags || !el.tags.name) {
        continue;
      }

      const nombre = el.tags.name.trim();
      if (!nombre) continue;

      // Obtener coordenadas (lat, lon)
      let lat = null;
      let lon = null;

      if (el.lat !== undefined && el.lon !== undefined) {
        lat = el.lat;
        lon = el.lon;
      } else if (el.center && el.center.lat !== undefined && el.center.lon !== undefined) {
        lat = el.center.lat;
        lon = el.center.lon;
      }

      // Si no hay coordenadas válidas, descartar
      if (lat === null || lon === null) {
        continue;
      }

      const tipo = determinarTipo(el.tags);
      const id = el.id;

      // Deduplicación: clave única basada en nombre (en minúsculas) y tipo
      const claveUnica = `${nombre.toLowerCase()}_${tipo}`;
      if (nombresYTiposVistos.has(claveUnica)) {
        continue;
      }
      nombresYTiposVistos.add(claveUnica);

      lugaresArray.push({
        id,
        nombre,
        tipo,
        lat,
        lon,
      });
    }

    console.log(`Procesamiento completado. Se obtuvieron ${lugaresArray.length} lugares únicos con nombre.`);

    // Ruta de salida: backend/places.json
    const outputPath = path.join(__dirname, 'places.json');
    fs.writeFileSync(outputPath, JSON.stringify(lugaresArray, null, 2), 'utf8');

    console.log(`¡Archivo guardado exitosamente en: ${outputPath}`);
  } catch (error) {
    console.error('Error durante la extracción de lugares de OpenStreetMap:', error.message);
    process.exit(1);
  }
}

extraerLugaresMadrid();
