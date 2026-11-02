# SombrApp
Aplicación móvil que proporciona a peatones y ciclistas rutas para llegar a sus destinos tales que estas minimizan la exposición solar. Además, ayuda a los conductores a localizar aparcamiento de manera que mientras el coche esté aparcado reciba la mayor cantidad de sombra en zonas cercanas a las facultades de la UCM.

## Miembros
* Galileo García Herraiz
* Min Guan
* José Manuel Lara Domenech
* Víctor Sanchez Romero
* Ouyang Zhou Zhou

## Características
COMO TESTEAR EL CODIGO CON PRUEBAS UNITARIAS :v
================================================

Las pruebas utilizan el runner nativo de Node.js, por lo que no es necesario instalar Jest ni Vitest.

1. Preparar el backend
----------------------

Desde la carpeta raíz del proyecto, instala las dependencias del backend la primera vez:

```cmd
cd backend
npm ci
```

2. Ejecutar las pruebas del backend
-----------------------------------

```cmd
cd backend
npm test
```

La suite inicia automáticamente el servidor en un puerto aislado y comprueba:

- El endpoint `/manifest`.
- Búsquedas vacías y búsquedas reales.
- La validación de latitud y longitud.
- Chunks existentes e inexistentes.
- Tiles `.glb` válidos e inexistentes.
- La cabecera MIME `model/gltf-binary`.

Resultado esperado:

```text
ℹ tests 7
ℹ pass 7
ℹ fail 0
```

No es necesario arrancar `server.js` manualmente para ejecutar estas pruebas.

3. Ejecutar las pruebas de la app móvil
---------------------------------------

```cmd
cd ..\mobile-app
npm test
```

La suite móvil comprueba:

- La carga y gestión de vecinos mediante `ChunkStream`.
- La deduplicación, evicción y cancelación de chunks.
- Los gestos de uno y dos dedos.
- El gesto de pinch y los cambios de dedos.
- La proyección Mercator y la referencia de tiles.
- Las matrices de sombras.
- La independencia de los uniforms de Three.js.

Resultado esperado:

```text
ℹ tests 10
ℹ pass 10
ℹ fail 0
```

4. Ejecutar una prueba concreta
------------------------------

Prueba concreta del backend:

```cmd
cd backend
node --test test/server.test.js
```

Pruebas concretas de la app móvil:

```cmd
cd mobile-app
node --test tests/map-gesture.test.cjs
node --test tests/shadow-map.test.cjs
node --test tests/chunk-stream.test.cjs
```

5. Guion rápido para explicarlo en directo
------------------------------------------

Las pruebas no modifican la aplicación. El backend se prueba levantando un servidor aislado y verificando sus endpoints. La app móvil prueba la lógica crítica con mocks, sin depender de un dispositivo físico, de una conexión real ni del renderizado 3D.

Después de modificar el código, basta con volver a ejecutar `npm test` en el directorio correspondiente. Si alguna prueba falla, Node mostrará el nombre de la prueba y el error para localizar la regresión.

Las pruebas del backend están en `backend/test` y las pruebas de la app móvil están en `mobile-app/tests`.

### Peatones y ciclistas
* Rutas que minimizan la exposición solar
* Preferencias ajustables: sombra y distancia
* Mapa 3D interactivo

### Conductores
* Búsqueda de aparcamiento cerca de las facultades de la UCM
* Estimación de sombra durante la estancia del coche
* Recomendación según cercanía y sombra

## ¿Qué es necesario instalar para poder utilizar nuestra aplicación?
Pincha en el enlace correspondiente para instalar nuestra aplicación y completa los siguientes pasos para ponerla en marcha en tu dispositivo:

### Requisitos previos de instalación

* **Verifica tu sistema operativo:** Asegúrate de que tu equipo cumpla con los requisitos mínimos de compatibilidad (Windows, macOS o Linux, según corresponda).
* **Conexión a internet estable:** Necesaria para descargar los paquetes complementarios y sincronizar los datos iniciales de la aplicación.
* **Dependencias recomendadas:** Algunas herramientas adicionales, como entornos de ejecución o librerías específicas, podrían solicitarse automáticamente durante el asistente de instalación.

> **Consejo:** Sigue detalladamente cada instrucción que aparezca en pantalla tras hacer clic en el instalador para asegurarte de que todas las funciones queden configuradas correctamente.


