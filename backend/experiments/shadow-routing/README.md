# Motor de rutas y datos de prueba

Esta carpeta conserva los módulos y datos que utiliza la integración de
`backend/routing/`. Las demos HTML, sus generadores, su servidor auxiliar y
sus capturas se han retirado; no es necesario abrir páginas de pruebas.

## Ejecutar la integración actual

Desde `backend`:

```sh
node server.js
```

La API es `POST /api/routes`. El contrato y los ejemplos están en
[`README CAMBIOS VICTOR.md`](../../../README%20CAMBIOS%20VICTOR.md).
La selección de origen/destino y el dibujo en la web deben consumir esta API.

## Comprobar el funcionamiento

```sh
npm test
npm run routes:check
```

La primera orden ejecuta las pruebas automáticas. La segunda necesita el addon
compilado, Python/OpenGL y chunks locales: comprueba una ruta HTTP real y la
reutilización de pesos. No valida la cobertura del campus completo.

## Archivos que se mantienen

- `core.mjs`, `compact-routing.mjs` y `rolling-routing.mjs`: código utilizado
  por el backend. `routing.mjs` sirve de referencia para las pruebas.
- `data/graph.json` y `data/campus-graph.json`: grafos disponibles en la API.
- Extractos OSM, configuraciones y `generate.mjs`: permiten regenerar grafos
  sin descargar los datos cada vez. Comandos: `npm run graph:generate`,
  `npm run graph:scale` y `npm run graph:campus`.
- `check-campus.mjs`, `campus-exposure.mjs` y `benchmark-routing.mjs`: mediciones
  de escalabilidad sin navegador, con pesos sintéticos. Ver `CAMPUS.md`.
- `output/report.json`: exposición histórica utilizada como fixture por las
  pruebas; no representa una nueva ejecución del shader nativo.
- Informes JSON de campus, rendimiento e integración nativa, que se regeneran
  con sus respectivas comprobaciones.

La política por franjas conserva el avance protegido y sus límites: puede
descartar desvíos sombreados que inicialmente aumenten la distancia restante.
La cobertura incompleta de modelos no se interpreta como sol.

Caminos: © OpenStreetMap contributors, ODbL,
https://www.openstreetmap.org/copyright. Modelos del proyecto: Ayuntamiento
de Madrid, según la documentación del dataset. Conservar las atribuciones.
