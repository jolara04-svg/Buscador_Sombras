# Cambios Víctor — correcciones del módulo de sombras

Este documento recoge las correcciones que han quedado en el código tras
reducir el cambio al mínimo. Se mantienen los nombres de variables, las
funciones y la estructura del compañero.

Solo se han modificado dos archivos de código: `backend/shaders/src/shader.py`
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
