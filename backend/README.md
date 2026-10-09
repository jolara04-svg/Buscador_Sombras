# Backend de `madrid_chunks`

Servidor Express de solo lectura para servir las teselas 3D de Madrid en formato glTF Binary (`.glb`). El dataset se conserva en el sistema de archivos; no se copia dentro de `backend/` ni se carga en una base de datos.

## Requisitos

- Node.js 18 o superior.
- El dataset extraído con esta estructura:

```text
madrid_chunks/
├── manifest.json
└── 16/
    └── <x>/
        └── <y>.glb
```

Por defecto, el servidor busca el dataset en `../madrid_chunks/madrid_chunks`, relativo a esta carpeta `backend/`.

## Arranque

```bash
npm install
npm start
```

Para permitir conexiones desde un móvil en la red local:

```bash
HOST=0.0.0.0 npm start
```

En Windows PowerShell, configura las variables con `$env:HOST = "0.0.0.0"` antes de ejecutar `npm start`.

Variables disponibles:

| Variable | Predeterminado | Descripción |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Interfaz de escucha. Usa `0.0.0.0` para una red local. |
| `PORT` | `3000` | Puerto HTTP. |
| `MADRID_CHUNKS_DIR` | `../madrid_chunks/madrid_chunks` | Ruta absoluta o relativa al directorio raíz del dataset. |
| `CORS_ORIGIN` | `*` | Origen permitido, o lista separada por comas. |

El servidor valida el manifiesto al arrancar y termina con error si la carpeta o el manifiesto no existen.

## API

### Estado

```text
GET /health
```

Devuelve `{"status":"ok"}`.

### Metadatos

```text
GET /api/madrid_chunks
```

Devuelve el zoom, recuento, rangos de coordenadas, tipo MIME, atribución y plantilla de URL.

### Manifiesto

```text
GET /api/madrid_chunks/manifest
```

Devuelve el índice original `x -> y[]`.

### Tesela glTF

```text
GET  /api/madrid_chunks/16/<x>/<y>.glb
HEAD /api/madrid_chunks/16/<x>/<y>.glb
```

Las coordenadas se comprueban contra `manifest.json`; no se expone el directorio completo mediante `express.static`. Las teselas se envían con `Content-Type: model/gltf-binary`, soporte de rangos y una caché de 24 horas.

Ejemplo:

```text
http://127.0.0.1:3000/api/madrid_chunks/16/32090/24720.glb
```

El dataset procede del Geoportal del Ayuntamiento de Madrid y la aplicación debe conservar esa atribución.

## Pruebas

```bash
npm test
```

Las pruebas crean fixtures pequeños y no necesitan leer los aproximadamente 916 MB del dataset real.
