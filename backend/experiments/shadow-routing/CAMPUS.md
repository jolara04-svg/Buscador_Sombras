# Prueba de Ciudad Universitaria

Caja de ensayo de 4096 x 4096 m centrada en 40.4485, -3.7275. Incluye el recinto
principal y su entorno; no representa una frontera administrativa ni todos los
campus de la UCM. Se conservan el extracto OSM y el grafo para repetir offline.

Desde `backend`:

```sh
node experiments/shadow-routing/generate.mjs --campus
node experiments/shadow-routing/check-campus.mjs
```

El generador reutiliza `data/campus-osm.json`; `--refresh` descarga otro extracto.
La fuente es OpenStreetMap mediante Overpass. Caminos: © OpenStreetMap
contributors, ODbL: https://www.openstreetmap.org/copyright.

La prueba compara 32 consultas de distancia y sombra con el Dijkstra de
referencia, comprueba costes y simula un paseo entre extremos del componente
principal. No fuerza conexiones entre las islas del extracto. Hay 109
componentes debiles y 30.940 nodos en el mayor: esto no garantiza conectividad
dirigida entre cualquier pareja; los casos sin ruta se conservan como tales.

Los pesos de `campus-exposure.mjs` son un campo sintetico espacial que cambia
cada 30 minutos. No son sombras fisicas, ni requieren modificar el shader.
Se aisla la correccion y el coste de buscar/recalcular rutas.

`output/campus-report.json` guarda cifras del ultimo ensayo, incluyendo
preparacion, consultas calientes y cada etapa. Los tiempos son de Node en el
equipo local, no de un movil. La memoria de buffers no incluye JSON, IDs,
objetos, worker, rasterizado ni modelos GLB. La preparacion y el Dijkstra
inverso siguen siendo O(V+E) en memoria; la cache temporal guarda solo una foto.

La politica de avance protegido restringe desvíos que aumenten la distancia
restante: no garantiza la minima exposicion total del paseo.

## Integración vigente

Las demos HTML del campus se retiraron. La integración con el shader real está
en `backend/routing/`, mediante `POST /api/routes`. Puede comprobarse desde
`backend` con `npm run routes:check`; esta prueba nativa usa una ruta local
con cobertura, no todo el campus. `check-campus.mjs` sigue midiendo el grafo
grande con pesos sintéticos para aislar el algoritmo.

El backend todavía carga el grafo completo. Para mapas mayores hay que
controlar también el pico de carga, la transferencia y la caché de geometría.
