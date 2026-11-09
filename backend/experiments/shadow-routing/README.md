# Laboratorio: grafo peatonal y máscara de sombra

**Ampliación:** ya existe una prueba de nueve zonas y rutas Dijkstra. Consultar
[resultados y explicación paso a paso](output/SCALE_RESULTS.md). Se ejecuta con
`npm run graph:scale` y `npm run shadow:scale`, desde `backend`. Para verla,
arrancar `npm run shadow:demo` y abrir http://127.0.0.1:3217/scale.html.
Los apartados siguientes describen la prueba inicial de una sola zona.

Prototipo aislado del mapa y del servidor de producción. Código comentado en
español; no añade dependencias. Utiliza Node, Express y las instalaciones de
Three.js 0.162 y TypeScript de `mobile-app/node_modules`.

## Repetir

Desde `backend`:

```sh
npm run graph:generate
npm run shadow:check
```

El segundo comando ejecuta Edge headless en Windows, inicia y cierra su servidor
local y guarda `output/report.json`, `output/mask-and-graph.png` y `output/page.png`.
Puede configurarse otro ejecutable Chromium mediante `BROWSER_PATH`. Necesita
permiso para iniciar el navegador y comunicarse por localhost. El navegador de
pruebas usa un perfil temporal independiente y SwiftShader: los tiempos NO son
un benchmark de GPU física ni de móvil. El perfil temporal se conserva en la
carpeta temporal del sistema para evitar borrar archivos ajenos.

Para abrir el laboratorio manualmente:

```sh
npm run shadow:demo
```

Abrir http://127.0.0.1:3217. El servidor solo escucha en localhost.

La respuesta OSM original queda guardada en `data/osm.json`, y el grafo generado
en `data/graph.json`. `graph:generate` reutiliza el original sin acceder a Internet;
para actualizarlo: `node experiments/shadow-routing/generate.mjs --refresh`.
Se puede configurar `OVERPASS_URL` si es necesario utilizar otro servidor Overpass.
Al cambiar la zona de `config.json`, actualizar también los datos con `--refresh`.

## Pasos implementados

1. Descargar caminos y nodos de una caja de 512 × 512 m alrededor de
   latitud 40.4526, longitud -3.7334, junto a Informática UCM. Se utiliza Overpass
   directamente en Node en lugar de instalar OSMnx/Python: los datos siguen siendo
   de OpenStreetMap y encajan con el script `extract-places.js` existente.
2. Crear un nodo por identificador OSM utilizado y una arista por pareja consecutiva
   de nodos de cada vía. Esto conserva la topología sin inventar intersecciones.
   Las aristas incluyen `source`, `target`, geometría local, longitud y permisos
   `forward`/`reverse`. Las aristas paralelas conservan identificadores distintos.
3. Cargar los GLB disponibles en un contexto de 5 × 5 tiles. Transformar cada
   geometría desde su referencia local al marco común del experimento.
4. Compilar y reutilizar directamente `shadersSombras.ts`, con blanco opaco sobre
   negro, sin transparencia ni profundidad. Proyectar en un render target de
   1024 × 1024: 0,5 m/píxel. Una sola lectura de píxeles para toda la zona.
5. Muestrear intervalos de hasta 2 m por arista y ponderar por la longitud que
   representa cada muestra. Generar `shadeM`, `sunM`, `shadeFraction` y
   `cost = shadeM + 4 * sunM`. Se conservan valores desconocidos fuera de la máscara.
6. Superponer el grafo coloreado sobre la máscara y exportar los resultados.
   Blanco: sombra proyectada; fondo oscuro: sol según el modelo. Verde: arista
   más sombreada; naranja: más soleada. Norte arriba. El color representa el
   porcentaje de TODA la arista, no el estado de cada píxel que atraviesa.

## Validación y primera ejecución

`npm test` incluye pruebas de coordenadas, orientación de filas WebGL, límites,
longitudes ponderadas, pesos y conectividad/permisos del grafo.

El navegador ejecuta además un control independiente con una caja de 10 m de
altura y sol al sur a 45°. Debe proyectar sombra al norte; un segmento que cruza
10 m de sombra y 10 m de sol debe tener fracción 0,5 y coste 50. El control fallará
si se invierte el eje vertical o no se renderiza correctamente la máscara.

Primera ejecución real: 875 nodos, 962 aristas, 19 GLB disponibles de 25 posiciones
consultadas, 338.891 triángulos, 5.489 muestras. Se evaluaron aproximadamente
9.995 m de segmentos, con 2.358 m clasificados como sombra. Las distancias suman
aristas, NO representan una ruta ni necesariamente caminos únicos sin solapamientos.
Consultar `output/report.json` para tiempos y cifras sin redondear.

## Límites y siguiente paso

- El sol es una configuración de prueba (180° / 35°), sin fecha solar calculada.
- Se replica el supuesto actual de suelo plano y normalización vertical por
  mínimo Z de cada chunk. El relieve y la georreferencia necesitan validación
  antes de interpretar los porcentajes como medidas reales de calle.
- Un tile ausente no demuestra ausencia de edificios. `unknownM = 0` significa
  que las muestras están dentro de la textura, NO que la cobertura de edificios
  esté verificada. Faltan árboles y otros obstáculos.
- El filtro peatonal es conservador pero incompleto: faltan reglas de barreras,
  horarios, accesos condicionales, aceras y áreas peatonales abiertas. No se deben
  usar estos datos como navegación validada. Se excluyen puentes y túneles.
- La prueba inicial no incluye Dijkstra; la ampliación sí implementa rutas entre
  zonas. Aún no hay snapping de origen/destino, endpoint de rutas de producción,
  integración móvil ni caché por fecha.
- La carga de GLB se hace secuencialmente para limitar memoria. En producción
  habría que medir GPU real, definir cobertura/margen según altura y sol, procesar
  por zonas y guardar solo fracciones por arista/franja temporal.

Fuentes técnicas: [Overpass QL](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL),
[render targets de Three.js](https://threejs.org/manual/pages/rendertargets.html).

Datos de caminos: © OpenStreetMap contributors, ODbL,
https://www.openstreetmap.org/copyright. Edificios: Ayuntamiento de Madrid,
según la documentación del dataset de este repositorio. Conservar atribuciones.
