# Sample 3: rutas sin bloquear la interfaz

Abrir `sample3.html` en un navegador con soporte de Web Workers. Incluye los
datos del laboratorio y funciona sin servidor. No modifica el modulo nativo
de sombras. La exposicion sigue siendo una instantanea precalculada.

El motor `compact-routing.mjs` prepara una topologia CSR y buffers numericos
una sola vez. Cambiar la penalizacion no reconstruye el grafo ni copia las
geometrias. Dijkstra usa un heap indexado: cada nodo ocupa como maximo una
posicion. Los buffers de busqueda se reutilizan mediante generaciones, sin
reiniciar todos los nodos en cada consulta. La memoria persistente es O(V+E),
y la cola es O(V). La optimalidad se conserva para los pesos no negativos.

La demo ejecuta las consultas en un worker y mantiene una activa y solo la
ultima pendiente. Las respuestas obsoletas no sustituyen la seleccion actual.
Al abandonar la pagina termina el worker. Una consulta explora como maximo
250.000 nodos; al llegar al limite informa del error y no devuelve rutas
parciales. El limite es de nodos, no una garantia de tiempo de respuesta.

## Repetir las comprobaciones

Desde `backend`:

```sh
node --test test/compact-routing.test.js test/shadow-routing.test.js
node experiments/shadow-routing/benchmark-routing.mjs
node experiments/shadow-routing/build-sample3.mjs
node experiments/shadow-routing/check-sample3.mjs
```

El ultimo comando comprueba la logica de interfaz y del worker en contextos
JavaScript simulados; no sustituye una comprobacion visual en navegador.
El benchmark guarda tiempos locales en `output/routing-benchmark.json` y
comprueba el coste exacto esperado de rejillas sinteticas de hasta 160.000
nodos y 319.200 tramos. La memoria publicada incluye solo buffers numericos,
no el pico de preparacion, IDs, objetos del grafo, imagenes ni geometria 3D.

## Limite de esta mejora

La demo conserva el grafo completo en memoria y usa una imagen fija de 1024 px.
No es un cargador de ciudades completas ni optimiza la generacion de sombras.
Para mapas que excedan el presupuesto total de memoria se necesita cargar
geometrias y mascaras por zonas, con cache limitada; la busqueda global debe
conservar las conexiones entre zonas. Recortar sin mas al entorno de origen
y destino podria eliminar la ruta optima. No se ha introducido ese recorte.
