# Prueba de Ciudad Universitaria

Caja de ensayo de 4096 x 4096 m centrada en 40.4485, -3.7275. Incluye el recinto
principal y su entorno; no representa una frontera administrativa ni todos los
campus de la UCM. Se conservan el extracto OSM y el grafo para repetir offline.

Desde `backend`:

```sh
node experiments/shadow-routing/generate.mjs --campus
node experiments/shadow-routing/check-campus.mjs
node experiments/shadow-routing/build-sample4.mjs --campus
node experiments/shadow-routing/check-sample4.mjs --campus
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

## Demo local

Abrir `sample5.html` con doble clic. Incluye una travesia de unos 7 km y el
recálculo cada media hora. Los escenarios pequeños anteriores siguen disponibles.
La proyeccion se adapta a la extension del grafo, sin ampliar la textura: el
fondo ocupa 1080 x 800 pixeles y se reutiliza durante la misma franja. Los nodos
se localizan por un indice Map; no se recorren todos para cada segmento.
El worker recibe solo topologia y coordenadas necesarias mediante un mensaje
de inicializacion; no se inserta una copia completa de los datos en su codigo.

El HTML es autonomo (unos 11 MB), no un cargador por zonas. Todavia se parsea
el grafo completo al abrir. Para una ciudad mucho mayor hay que controlar
tambien ese pico, la transferencia y la cache de geometria; estas medidas no
son una garantia contra agotar memoria con cualquier tamano de entrada.
La comprobacion de interfaz usa contextos JavaScript simulados, no un navegador
real: se comprueban mensajes, etapas, llegada y reutilizacion del fondo, no
la presentacion visual ni la politica del navegador para workers locales.
