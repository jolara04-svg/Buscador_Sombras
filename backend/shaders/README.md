# Instrucciones

Primero, hay que instalar en el ordenador todas las dependencias y herramientas necesarias:

* Un compilador de C++
* Los siguientes paquetes de Node.js
    + node-addon-api
    + bindings
* Python, de la versión 3.12 en adelante, preferiblemente la 3.13
* Las siguientes librerías de Python
    + Pygame
    + PyOpenGL
    + Numpy
    + Trimesh

La compilación necesita las cabeceras de la API de C de Python y NumPy. Desde una terminal en `backend\shaders` puedes instalar NumPy con:

```cmd
python -m pip install numpy
```

`PyOpenGL`, `trimesh` y `pygame` se necesitan para ejecutar la parte Python/OpenGL del addon:

```cmd
python -m pip install PyOpenGL trimesh
```

`pygame` es necesario para `shader.py` y `debug_renderCube`. En Python 3.14 puede no existir una rueda compatible y `pip` puede intentar compilarlo desde código fuente. En ese caso, usa una versión de pygame compatible. Si cambias a Python 3.13 para la parte Python/OpenGL, selecciona esa misma instalación con `npm_config_python` y vuelve a ejecutar `npm ci` para que el addon se compile contra la misma versión. No es necesario para compilar el addon ni para ejecutar las pruebas JavaScript del backend.

El archivo `binding.gyp` detecta automáticamente:

- La carpeta que contiene `Python.h`.
- La carpeta de cabeceras devuelta por `numpy.get_include()`.
- La librería `pythonXY.lib` correspondiente a la versión de Python usada.

No es necesario copiar manualmente `include`, `Python.h`, `numpy/arrayobject.h` ni `python313.lib` dentro del repositorio.

Si tienes varias instalaciones de Python, puedes seleccionar una explícitamente:

```cmd
set npm_config_python=C:\Path\To\Python\python.exe
npm install
```

También puedes proporcionar las rutas manualmente si tu instalación no sigue la estructura habitual:

```cmd
set PYTHON_INCLUDE_DIR=C:\Path\To\Python\include
set NUMPY_INCLUDE_DIR=C:\Path\To\numpy\_core\include
set PYTHON_LIBRARY=C:\Path\To\Python\libs\python314.lib
npm install
```

Para compilar el addon, abre una terminal en este directorio y ejecuta `npm ci`. Para probarlo, `npm test`.

Para instalarlo en el backend, ejecuta `npm install ./shaders` en `backend`.
