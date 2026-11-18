# Sample 4: recalcular al cambiar las sombras cada 30 minutos

Abrir `sample4.html`. No requiere servidor ni modifica el shader nativo.
El grafo UCM es real; sus futuras exposiciones son simulaciones controladas,
no nuevas ejecuciones solares. El escenario largo reproduce un fallo conocido.

## Estrategia implementada

1. Estimar la duracion fisica con longitud / velocidad peatonal.
2. Calcular la ruta al destino con la foto de sombra de la franja actual.
3. Recorrer solo el prefijo que cabe hasta el siguiente cambio del reloj.
4. Conservar el nodo o la fraccion exacta de calle alcanzada.
5. Obtener la nueva foto y ejecutar Dijkstra de nuevo desde esa posicion.

No se caminan siempre 30 minutos: desde 12:20 quedan 10 hasta 12:30. Si la
ruta termina antes del cambio, se llega sin esperar. El coste ponderado de
sol decide la ruta, pero no se interpreta como duracion de la marcha.
Penalizacion 1 equivale a minimizar distancia en la red permitida; penalizacion
4 permite desvio para reducir sol. No maximiza simultaneamente rapidez y sombra.

## Resultado de probar el enfoque original

En la red de control A–B mide 2520 m: exactamente 30 min a 1,4 m/s.
Las fotos alternan de forma que primero conviene A–B–destino y luego
B–A–C–destino. El recálculo sin proteccion repite A–B–A–B sin llegar.
Cada Dijkstra es correcto para su foto; la politica de replanteamiento oscila.

La variante protegida conserva el enfoque, pero calcula una vez las distancias
minimas al destino en el grafo dirigido inverso. Solo permite avanzar por aristas
que reduzcan estrictamente esa distancia. A mitad de una calle continua hacia el
siguiente cruce. En el escenario de control llega tras 6520 m (unos 77,6 min).
La ruta no puede formar un ciclo entre cruces: la distancia restante disminuye.
Si las sombras reales no cambian la conectividad y todas las aristas tienen
cobertura, siempre queda al menos la alternativa de la distancia minima.

## Limites

La proteccion puede descartar desvíos sombreados utiles que primero alejen del
destino en distancia de red. No garantiza el minimo sol total a lo largo del
viaje y no espera cambios futuros. Un cambio de acceso/cobertura puede dejar
sin ruta; se informa y no se inventan pesos. La distancia restante se prepara
para una topologia fija; si cambia, hay que crear de nuevo el planificador.
Las fracciones de aristas usan exposicion media: un proveedor con muestras
espaciales permitiria medir el prefijo de una calle con mayor exactitud.

La interfaz ejecuta la planificacion en un worker. El motor conserva una sola
foto temporal en cache. Prepara la adyacencia de cada nueva consulta; la demo
no supone que se pueda mantener una ciudad completa en memoria.

## Repetir

Desde `backend`:

```sh
node --test test/rolling-routing.test.js test/compact-routing.test.js test/shadow-routing.test.js
node experiments/shadow-routing/build-sample4.mjs
node experiments/shadow-routing/check-sample4.mjs
```

El ultimo comando ejecuta la logica de interfaz y worker en contextos JavaScript
simulados: no sustituye la inspeccion visual de un navegador real.

Para integrar fotos reales, pasar `getExposure(slot)` a `createRollingPlanner`.
`slot = floor(segundos / 1800)`; el origen temporal debe coincidir con el del
proveedor. En produccion, usar instantes absolutos y una convencion explicita
de zona horaria. No interpolar silenciosamente una foto ausente.
