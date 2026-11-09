# Instrucciones

Primero, hay que instalar en el ordenador todas las dependencias y herramientas necesarias:

* Un compilador de C++
* Los siguientes paquetes de Node.js
    + node-addon-api
    + bindings
* Python, de la versión 3.12 en adelante, preferiblemente la 3.13
    > Es muy importante que descarges las cabeceras de la API de C junto con Python.
    > Si están presentes, se encuentran en `.../python/python313/include`. Nótese que puede variar en el número según la versión.
    > La versión disponible en <https://python.org> viene con estos archivos.
* Las siguientes librerías de Python
    + Pygame
    + PyOpenGL
    + Numpy
        > Al igual que con Python, se necesitan las cabeceras de la API de C de NumPy.
        > Deberían estar en `.../python/python313/Lib/site-packages/numpy/_core/include`
        > Instalándolo con `pip` vienen.

Ahora toca colocarlo todo en su sitio

Primero, localiza los ficheros `.h` de Python y NumPy. Copia las carpetas `include` y pégalas en `src`.
> Alternativamente, puedes poner los directorios donde se encuentran en el archivo `binding.gyp`

Segundo, localiza el archivo `python313.lib` (El número variará según la versión) y pégalo en este directorio. 
> Alternativamente, puedes proporcionar un camino absoluto al archivo en `binding.gyp`

Para compilar el addon, abre una terminal en este directorio y ejecuta `npm ci`. Para probarlo, `npm test`.

Para instalarlo en el backend, ejecuta `npm install ./shaders` en `backend`. 