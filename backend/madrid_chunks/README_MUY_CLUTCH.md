# Madrid 3D Buildings Dataset (LOD2 Chunks Z16)

Dataset espacial tridimensional optimizado para **renderizado móvil en tiempo real** y **cálculo de proyección de sombras solares**.

Este conjunto de datos procesa, filtra y particiona la cartografía tridimensional municipal de Madrid en una cuadrícula piramidal estándar compatible con motores WebGL, Three.js, Babylon.js, Unity y clientes cartográficos basados en **Slippy Map**.

---

## 1. Ficha Técnica General

**IMPORTANTE:** Hay que dar credito al ayuntamiento en la app por los datos. LA DIMENSION MEDIA POR CHUNK NO ES FIABLE hay edificios muy grandes en Madrid asi q hay incluso un chunk de 1km de largo, aunque eso no afecta a la app realmente.

| Parámetro | Especificación |
| :--- | :--- |
| **Fuente original** | Ayuntamiento de Madrid — Geoportal (`MADRID_3D_2025_01.slpk`) |
| **Nivel de Detalle (LOD)** | **LOD2** exclusivo (muros verticales y cubiertas con inclinación real) |
| **Formato de entrega** | **glTF 2.0 Binary (`.glb`)** unificado por chunk |
| **Tipo MIME** | `model/gltf-binary` |
| **Esquema de particionado** | **Slippy Map Tiles (Web Mercator EPSG:3857)** |
| **Nivel de Zoom ($Z$)** | **Zoom 16** |
| **Dimensión media por chunk** | $\approx 465.6\text{ m} \times 465.6\text{ m}$ (a latitud $\approx 40.41^\circ\text{ N}$) |
| **Sistema de referencia local** | **ENU (East-North-Up)** con normalización **RTC a `(0, 0, 0)`** |
| **Orientación vertical** | **$Z$-Up** (el eje $Z$ positivo representa la altura hacia el cenit) |

---

## 2. Estructura de Directorios

El dataset sigue la jerarquía canónica de teselas web `{z}/{x}/{y}.glb`:

```text
madrid_chunks/
├── manifest.json              # Índice ligero de tiles existentes
├── README.md                  # Especificación técnica (este archivo)
└── 16/                        # Zoom level 16
    ├── 32090/  
    │   ├── 24720.glb
    │   └── 24721.glb
    ├── 32094/                 # Coordenada X
    │   ├── 24723.glb
    │   ├── 24724.glb          # Coordenada Y          
    │   └── 24725.glb
    └── ...