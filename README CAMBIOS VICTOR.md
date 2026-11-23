# Cambios Víctor — correcciones del módulo de sombras

Este documento recoge las correcciones que han quedado en el código tras
reducir el cambio al mínimo. Se mantienen los nombres de variables, las
funciones y la estructura del compañero.

Para esas correcciones solo se han modificado dos archivos de código: `backend/shaders/src/shader.py`
y `backend/shaders/src/shadowCalc.c`. Son nueve líneas nuevas o sustituidas:
una de lectura de píxeles y ocho de caché y gestión de memoria.

## 1. Leer el píxel correcto

**Archivo:** `backend/shaders/src/shader.py`, función `getShadeAt`.

Antes:

```python
if surface[x][y]:
```

Ahora:

```python
if surface[surface.shape[0] - 1 - y][x]:
```

**Por qué:** el array se indexa primero por fila y después por columna.
Además, `glReadPixels` entrega las filas desde abajo, mientras que el eje Y
de los tiles crece hacia el sur. Se corrigen el intercambio de ejes y la
orientación vertical para consultar la sombra del punto solicitado.
Se conserva el `if/else` original.

## 2. Insertar las texturas en la posición de entrada de la caché

**Archivo:** `backend/shaders/src/shadowCalc.c`, función `cacheTexture`.

En la rama de inserción posterior al primer elemento, las cinco asignaciones
de `surface`, `x`, `y`, `elev` y `azim` utilizan ahora:

```c
textureCache[textureCache_end]
```

Antes utilizaban `textureCache[textureCache_start]`.

**Por qué:** `textureCache_end` indica dónde insertar; `textureCache_start`
identifica la entrada más antigua. Escribir en `start` sobrescribía entradas
anteriores mientras el índice `end` avanzaba por otros huecos. Se corrige el
índice utilizado, sin renombrar ninguna variable ni cambiar el diseño de la
caché. La liberación del elemento antiguo cuando se llena se mantiene.

## 3. Liberar la referencia de cada malla procesada

**Archivo:** `backend/shaders/src/shadowCalc.c`, función `populate`.

Se añade al final de cada iteración exitosa:

```c
Py_DECREF(item);
```

**Por qué:** `PyIter_Next` entrega una referencia nueva. Las ramas de error
ya liberaban `item`, pero el recorrido exitoso no lo hacía. Ahora cada malla
deja de quedar retenida por esa referencia al terminar de copiar sus datos.

## 4. Liberar los buffers del modelo si falla su población

**Archivo:** `backend/shaders/src/shadowCalc.c`, función `newModel`.

En el error de `populate`, se sustituye:

```c
free(model);
```

por:

```c
decref(model);
```

**Por qué:** en ese punto ya están reservados los arrays de vértices y
triángulos. `free(model)` solo liberaba la estructura exterior. La función
`decref` existente libera también ambos arrays al agotarse la referencia.

## 5. Liberar el objeto Python cargado desde el GLB

**Archivo:** `backend/shaders/src/shadowCalc.c`, función `loadModel`.

Después de `model=newModel(mesh)` se añade:

```c
Py_DECREF(mesh);
```

**Por qué:** una vez copiados los datos al modelo C, esa referencia al objeto
Python ya no es necesaria. La liberación se hace antes de comprobar el
resultado de `newModel`, para cubrir tanto el éxito como el error.

## Comprobaciones realizadas

- Lectura de un píxel asimétrico, orientación vertical y las cuatro esquinas
  del tile: correctas.
- Prueba aislada compilando el C real: 192 inserciones y expulsiones de
  texturas, y 192 cargas de modelos con varias mallas. Se comprobaron los
  índices y que las referencias Python revisadas no aumentaran.
- Las 16 pruebas existentes de rutas, pesos y recálculo temporal pasaron.
- Se generó una comparación con el `shader.py` real en Python/OpenGL:
  seis chunks cargados y 120.609 triángulos. Se compararon ambas lecturas
  sobre la misma imagen, sin cambiar la proyección.

Estas comprobaciones no certifican toda la gestión de memoria, la exactitud
física de las sombras ni la integración completa con la aplicación.

## Material auxiliar retirado y validación pendiente

Durante la comprobación se añadieron pruebas temporales, una imagen comparativa
y dependencias locales de previsualización dentro de `build/preview-deps`.
Ese material ya no forma parte de la entrega; se conserva únicamente la
corrección mínima de los dos archivos y este documento.

Se intentó recompilar el addon de Node. La compilación llegó al enlazado,
pero quedó bloqueada porque la configuración mezclaba Python 3.13 y 3.14
y solicitaba `python313.lib`. No se modificó esa configuración ni se da por
validado el addon recompilado. La comparación visual se ejecutó por separado
con Python/OpenGL.

## Integración posterior: sombras de Víctor y rutas

Se ha añadido una capa de unión, sin volver a modificar el código nativo ni
renombrar sus variables:

- `backend/routing/victor-adapter.mjs`: convierte la fracción devuelta por
  `getShadow` en metros de sombra y sol por arista. Divide los segmentos en
  partes de hasta 16 m para no usar las mismas 17 muestras nativas en una
  calle arbitrariamente larga. Pondera por longitud, valida los resultados y
  utiliza nuestro planificador de recálculo cada media hora.
- `backend/routing/victor-worker.cjs`: carga el addon y lo inicializa en un
  proceso separado. Las llamadas a Python/OpenGL se ejecutan en un único hilo.
  Así, un cierre del módulo nativo no cierra también el servidor HTTP.
- `backend/routing/routes.cjs`: publica `POST /api/routes`. Solo permite una
  petición nativa a la vez, sin cola ilimitada, y detiene el proceso si supera
  120 segundos. El servidor lo registra mediante una línea en `server.js`.

El adaptador conserva la firma de Víctor: longitud, latitud de cada extremo,
elevación y azimut. El HTTP recibe ángulos en grados, con azimut desde el norte
en sentido horario; el adaptador los convierte a los radianes y la convención
del eje este de la matriz nativa. La foto se reutiliza solo cuando coinciden
grafo, franja y ángulos. Se conserva una sola foto en caché.

### Ejemplo de petición

Arrancar el backend con `node server.js` y enviar JSON a
`http://localhost:3000/api/routes`:

```json
{
  "graph": "local",
  "source": "13567249178",
  "target": "13567249179",
  "at": "2026-11-22T12:20:00+01:00",
  "speedMps": 1.4,
  "penalty": 4,
  "sun": { "elevationDeg": 35, "azimuthDeg": 180 }
}
```

Los ángulos del ejemplo son de prueba, no una posición solar calculada para
esa fecha. Quien llama debe calcular `sun` para el inicio de la franja de
media hora. `at` necesita zona horaria explícita. Se admite `graph: "campus"`
para el grafo grande guardado. Los identificadores deben pertenecer al grafo
elegido; el endpoint no conecta automáticamente coordenadas GPS a las calles.

La respuesta contiene la ruta prevista (`plannedGeometry`), la etapa hasta
el cambio, `state` y `nextRecalculateAt`. Si no se ha llegado, la siguiente
petición puede enviar ese `state` en lugar de `source`, mantener `target` y
actualizar fecha y sol. `state` es una posición prevista, no una medición GPS:
si el usuario se para o se desvía, el cliente debe usar su posición real.

La aplicación móvil todavía debe consumir este endpoint; este cambio une
las dos partes en el backend, sin modificar la interfaz del móvil.

### Cobertura, límites y estado de validación

Antes de consultar un subsegmento se comprueba que existen los chunks
centrales de sus 17 muestras. Una arista sin cobertura queda desconocida y
no se transforma en sol ni recibe pesos sintéticos. Aun así, la ausencia de
chunks vecinos puede omitir edificios que proyecten sombra desde fuera.
La integración actual utiliza edificios, no la capa de árboles.

La respuesta mantiene la política de avance protegido ya explicada en las
demos; no garantiza el mínimo sol global. El coste de generar pesos reales
no es el mismo que buscar con pesos preparados: no se extrapolan a este
endpoint los tiempos anteriores de Dijkstra sobre sombras sintéticas.

`npm test`, desde `backend`, supera 38 pruebas. Las pruebas nuevas usan un
doble del addon para verificar el contrato, la conversión de pesos, la caché,
el avance parcial, las respuestas HTTP y los errores del proceso. No validan
el resultado físico del shader real.

Finalmente se compiló el addon ajustando únicamente variables de entorno a
Python 3.14, sin cambiar fuentes ni `binding.gyp`. Las dependencias Python de
ejecución se instalaron dentro de `backend/shaders/build/runtime-deps`, sin
modificar el Python global. El proceso nativo añade esa ruta a `PYTHONPATH`.

Desde `backend/shaders`, en PowerShell, se puede repetir la preparación:

```powershell
$env:PYTHON_INCLUDE_DIR = python -B -c "import sysconfig; print(sysconfig.get_path('include'))"
$env:NUMPY_INCLUDE_DIR = python -B -c "import numpy; print(numpy.get_include())"
$env:PYTHON_LIBRARY = python -B -c "import sys, pathlib; print(pathlib.Path(sys.base_prefix) / 'libs' / ('python'+str(sys.version_info.major)+str(sys.version_info.minor)+'.lib'))"
npm rebuild
python -m pip install --target build/runtime-deps --no-deps pygame-ce trimesh
```

NumPy y PyOpenGL deben estar disponibles en ese mismo Python. Las librerías,
cabeceras y dependencias deben corresponder a su versión; las rutas del ejemplo
de compilación son para Windows.

La prueba real se repite desde `backend` con `node routing/check-native.cjs`.
Hace dos peticiones HTTP al endpoint usando el addon real, sin dobles, y guarda
`experiments/shadow-routing/output/victor-integration-report.json`. La ruta de
ejemplo mide 56,16 m: se obtuvieron 31,38 m de sombra y 24,78 m de sol. La segunda
consulta reutilizó la foto y no llamó de nuevo al shader. No valida un paseo
completo por el campus ni la exactitud física de la proyección.

En el grafo local, 875 de 962 aristas resultaron desconocidas por falta de
chunks centrales en alguna muestra. La pareja de nodos usada en las demos
anteriores no tiene un recorrido cubierto con estos datos y devuelve 422;
el ejemplo HTTP de este documento usa una arista cubierta. Esta comprobación
evita presentar como soleadas zonas que no tienen modelos disponibles.

Si el addon falta o falla, el endpoint devuelve un error 503; nunca recurre a
las sombras simuladas de las demos. Un recorrido sin conexión/cobertura
devuelve 422, y una entrada mal formada, 400.

## Limpieza de las demos HTML

Se han retirado todos los HTML versionados del laboratorio: las páginas de
una zona, escala y los ejemplos temporales 4/5, incluida su plantilla.
También se eliminan sus scripts de interfaz, generadores, comprobadores de
páginas, servidor auxiliar y capturas, porque la integración actual se prueba
directamente contra el backend. Los antiguos comandos `shadow:demo`,
`shadow:check` y `shadow:scale` ya no están en `package.json`.

Se mantienen el código de rutas, los grafos y las pruebas automáticas.
Desde `backend`, `npm test` comprueba el backend y `npm run routes:check`
ejecuta la prueba HTTP con el shader real. No se modifica el código de Víctor
ni la interfaz móvil en esta limpieza.

## Selección de origen y destino en el mapa 2D

Se completa el flujo existente de `mobile-app/src/app/index.tsx`, manteniendo
los estados `origen` y `destino`. La ubicación obtenida al abrir la aplicación
se guarda por separado: consultar un lugar no convierte ese lugar en tu GPS.
En modo ruta, el origen utiliza esa ubicación por defecto. Si el permiso falla,
Madrid solo sirve de centro inicial del mapa; no se presenta como tu origen.

Elegir un resultado del buscador en la vista 2D lo fija como destino y abre
los campos de ruta. Se puede buscar un origen alternativo o volver a
«Mi ubicación». Al editar un campo se descarta su selección anterior; una
respuesta de búsqueda antigua no puede reemplazar los resultados del otro
campo. Limpiar la selección restaura el origen GPS y deja el destino vacío.

Las versiones web y móvil de `Mapa2D` muestran los marcadores etiquetados
«Origen» y «Destino» y encuadran ambos. No se añaden páginas HTML de prueba ni
se modifica el shader de Víctor. La conexión de estas coordenadas con el
cálculo de Dijkstra se añade en el apartado siguiente.

Validación: 40 pruebas del frontend superadas, incluidas cuatro sobre la
selección, el permiso denegado, las respuestas antiguas y la limpieza.
TypeScript pasa. Se comprobó en navegador la elección de dos lugares y los
dos marcadores; el GPS real no estuvo disponible en ese navegador y su caso
se verificó con un servicio de ubicación controlado en las pruebas.
El lint de los archivos modificados no tiene errores; el lint general conserva
dos errores previos en `ShadowLayerControls.tsx`, ajenos a esta selección.

## Rutas desde los puntos del mapa 2D

Se añade «Calcular rutas» después de elegir origen y destino. Calcula primero
la alternativa más rápida y después la que prioriza la sombra. Las tarjetas
permiten seleccionar la línea destacada y muestran distancia, tiempo estimado
y sombra cuando se ha consultado. La rápida minimiza distancia con velocidad
constante de 1,4 m/s: no utiliza tráfico ni tiempos reales de acceso.

La preferencia empieza en 50 % y se puede ajustar. Para un peso `w`, Dijkstra
minimiza `(1-w) * metros_totales + w * metros_al_sol`: al 50 % un metro al
sol cuesta el doble que uno en sombra. No significa prometer un recorrido
con 50 % de sombra. Con 0 % se calcula por distancia sin invocar el shader;
con 100 % se minimizan metros al sol, pudiendo aceptar desvíos largos.

`POST /api/routes` acepta ahora `origin` y `destination` con `{lat, lon}`,
`mode` (`fastest` o `shade`), `shadePreference` (0–1, predeterminado 0.5),
`at` con zona horaria y `sun` para la alternativa con sombra. Se conserva
el contrato anterior basado en identificadores de nodos. La aplicación usa
el grafo del campus y la posición solar al comienzo de la franja de 30 minutos.

`snap-points.mjs` conecta cada punto con el camino más cercano a menos de
100 m, dividiendo la arista sin perder sentidos, curvas ni conexiones OSM.
Las versiones web y WebView dibujan la geometría real de ambas rutas. Los
accesos entre marcadores y caminos aparecen discontinuos: no se comprueba
si atraviesan edificios, vallas o entradas cerradas.

La ruta rápida no depende del módulo nativo. Para la sombra se descartan
caminos sin cobertura, sin considerarlos soleados. Antes de consultar la
GPU se busca un recorrido cubierto de longitud L. Para `w < 1`, una mejora
no puede medir más de `L / (1-w)`; esta cota permite excluir consultas lejanas
sin cambiar el óptimo del modelo actual. La caché conserva una sola foto,
incluida su zona de consulta. Con 100 % no existe esa cota y consultar zonas
grandes sigue pudiendo sobrecargar el módulo nativo. No se cambia su código.

Si falta cobertura o falla el shader, se informa del fallo y permanece
disponible la rápida. De noche se resuelve por distancia sin invocar la GPU.
Cambiar puntos, fecha, hora o peso invalida los resultados y cancela la
espera anterior, evitando pintar respuestas de una selección antigua.

La alternativa usa la foto de sombra actual y avisa de su próxima caducidad.
Se devuelve también el tramo hasta el siguiente cambio de media hora. Esta
pantalla no implementa seguimiento GPS ni recálculo automático durante la
marcha; hay que volver a pulsar «Calcular rutas» al cambiar la franja.

Validación: 42 pruebas del backend y 53 del frontend superadas, además de
TypeScript y lint de los archivos modificados (sin errores). Consulta HTTP
real con el grafo del campus: 56,16 m, 31,38 m de sombra y 24,78 m de sol,
con ángulos de prueba de 35°/180°; no valida todo el campus. En navegador se
seleccionaron puntos del mapa, se calcularon ambas alternativas y se verificó
el dibujo con preferencia inicial del 50 %. No se añaden demos HTML ni se
crean commits.
