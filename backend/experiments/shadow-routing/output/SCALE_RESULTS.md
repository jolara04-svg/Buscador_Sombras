# Resultado de la prueba ampliada

Fecha de ejecución (UTC): 2026-11-09T22:50:57.039Z.

## Qué se ha hecho

1. Descargar un extracto real de OpenStreetMap de 1.536 × 1.536 m alrededor de
   Informática UCM: **2,36 km²**, nueve veces la superficie del ensayo inicial.
   La preparación independiente tardó 36.1 s
   (entrada/descarga y guardado del original: 30.4 s;
   construcción del grafo: 2.4 s). No se repite
   esta descarga en cada petición de ruta.
2. Conservar un único grafo de **6212 nodos y 6819
   aristas**, con direcciones peatonales. No se corta el grafo en las fronteras
   de las máscaras. El JSON ocupa 4.0 MiB.
3. Cargar las capas seleccionadas (edificios: 43 GLB, 1.063.303 triángulos; vegetación: 31 GLB, 1.989.936 triángulos). Se incluye contexto exterior
   para sombras entrantes. La altura máxima del modelo cargado produce
   136.8 m de desplazamiento, menor que el margen
   configurado de 512 m.
4. Reutilizar el shader del proyecto para crear máscaras independientes de
   512 × 512 m a 0,5 m/píxel. Cada máscara se renderiza en el mismo target de
   1024 × 1024, se lee de una vez y se reduce a un byte por píxel. Se descartan
   meshes cuyos límites PROYECTADOS no intersectan la zona, no sus límites originales.
5. Muestrear los caminos cada 2 m como máximo. Una arista que cruza una frontera
   consulta las máscaras de todas las fuentes activas, combinadas con los pesos
   edificios=1, vegetación=0.75. Acumular sombra y sol por longitud y aplicar peso =
   metros_sombra + 4 × metros_sol. La nueva visualización colorea cada
   intervalo: verde coincide con sombra según la resolución de muestreo; naranja con sol.
6. Implementar Dijkstra con lista de adyacencia y heap binario. Comparar tres
   pares de extremos: SO→NE, NO→SE y oeste→este, para cada uno por distancia y
   por coste solar. Los extremos se seleccionan entre nodos existentes del
   componente débil mayor, no mediante snapping de coordenadas arbitrarias.
7. Repetir cada escenario tres veces y medir 30 búsquedas adicionales por
   repetición con los pesos preparados. Se separan carga, máscaras, muestreo,
   preparación de adyacencia, búsquedas y memoria.

## Tiempos observados

Carga local del grafo y metadata: **35.9 ms**.
Carga y preparación de todas las capas: **673.8 ms**,
incluyendo 339.0 ms de transferencia local,
50.1 ms de parseo y 281.4 ms
de transformación/preparación.

Medianas de tres repeticiones, con las capas ya cargadas:

| Zonas | Superficie km² | Aristas | Máscaras ms | Muestreo ms | 6 búsquedas y métricas ms | Proceso completo ms |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 0.26 | 962 | 22.5 | 0.9 | 1.0 | 24.6 |
| 4 | 1.05 | 3585 | 72.2 | 4.1 | 4.8 | 82.0 |
| 9 | 2.36 | 6819 | 293.7 | 12.8 | 9.3 | 319.0 |

El proceso incluye renderizado, lectura, conversión, muestreo, adyacencia y seis
búsquedas; excluye dibujo de la vista previa y las 30 consultas de medición caliente.

**Primera preparación de las nueve zonas, desde inicio del módulo hasta terminar
las seis búsquedas: 1988.7 ms.** Incluye carga local y
primera ejecución del shader, sin generación/descarga OSM, arranque del navegador
ni descarga de los módulos JS previos al inicio del módulo.

Una búsqueda con pesos y adyacencia preparados en el último ensayo de nueve zonas:
mediana **1.10 ms**, p95
**1.50 ms** (30 consultas, tres pares de extremos).
Esto simula la reutilización de exposición; todavía no hay un servicio de caché
por fecha, TTL o gestión de concurrencia.

La ejecución completa de los nueve ensayos y visualización duró
3833.7 ms dentro del módulo; el ejecutor
observó 4672.9 ms desde navegar
hasta detectar el resultado, cifra que también incluye la carga inicial de módulos
y el intervalo de sondeo del ejecutor.

## Rutas entre zonas (escenario de nueve zonas)

| Par | Zonas recorridas | Ruta corta m | Ruta con sombra m | Sol en ruta corta m | Sol en ruta con sombra m |
|---|---:|---:|---:|---:|---:|
| SO → NE | 5 | 1687.5 | 1696.0 | 1436.8 | 1365.3 |
| NO → SE | 5 | 2648.8 | 2763.0 | 2647.6 | 2437.1 |
| Oeste → Este | 3 | 1403.5 | 1438.9 | 1322.6 | 1251.7 |

Las tres rutas cruzan fronteras de máscaras correctamente. Se comprueba que
la ruta solar no supera el coste ponderado de la más corta, y que la más corta
no supera en longitud a la ruta solar. Una preferencia por sombra no obliga a
cambiar de recorrido: en algunos pares el óptimo sigue siendo el mismo.

## Memoria (MiB = 1.048.576 bytes)

| Medida | MiB | Alcance |
|---|---:|---|
| Mayor heap JS observado | 143.5 | Instantáneas de Chromium, no pico de memoria total |
| Buffers de geometría retenidos | 55.8 | CPU; posiciones e índices, sin normales/UV |
| Atlas binario de nueve máscaras | 18.0 | CPU; se descarta después de evaluar |
| Buffer temporal RGBA reutilizado | 4.0 | CPU; uno para todas las zonas |
| Color del render target reutilizado | 4.0 | Tamaño nominal WebGL; excluye driver y geometría GPU |
| Fracciones por arista en Float32 | 0.026 | Límite inferior de una caché compacta, sin IDs/contenedores |
| RSS final de Express | 87.3 | Proceso servidor del laboratorio, excluye navegador |

**No sumar estas filas:** algunas mediciones se solapan y otras corresponden a
procesos distintos. No se ha medido el pico RSS de todo Chromium ni la memoria
total de GPU. El informe JSON conserva instantáneas y tamaño de buffers explícitos.
La misma escena ampliada se mantiene residente en los tres escenarios, por lo
que esta prueba no compara memoria de geometrías cargadas bajo demanda por zona.

## Interpretación para Madrid

Se ha demostrado la continuidad del grafo entre zonas y que la búsqueda es
mucho más barata que generar/leer máscaras en este ensayo. El siguiente paso
es un servicio de precálculo/caché de porcentajes por zona y franja temporal,
con límites de memoria y carga de geometrías bajo demanda. Dijkstra podría
reutilizar esos valores entre usuarios sin regenerar sombras por petición.

**No demuestra aún que todo Madrid esté listo:** son 2,36 km², un único usuario,
un solo Sol fijo y WebGL por software (SwiftShader). Los datos proceden de disco
local y no se ha vaciado la caché del sistema operativo. Tres repeticiones no
permiten predecir capacidad concurrente ni extrapolar linealmente a todo el municipio.
Faltan validación de relieve, georreferencia, cobertura y accesos; un
tile ausente no certifica ausencia de edificios. El grafo tiene componentes
desconectados y los endpoints se eligieron explícitamente en el mayor.

El cálculo se ejecuta en el navegador de pruebas; Express sirve los datos.
No se ha integrado todavía en la app ni movido a un worker de producción del
backend. Las imágenes son herramientas de diagnóstico.

## Repetir y abrir

Desde backend:

```powershell
npm run graph:scale
npm run shadow:scale
npm run shadow:demo
```

Abrir http://127.0.0.1:3217/scale.html. El primer comando reutiliza OSM si ya
está descargado. Para actualizar: node experiments/shadow-routing/generate.mjs
--scale --refresh. El segundo ejecuta Edge headless y regenera este documento,
scale-report.json, scale-mask-and-graph.png y scale-page.png en output/.

Pruebas: npm test (incluye fronteras de atlas, rutas dirigidas, pesos desconocidos
y comparación de Dijkstra con una referencia Floyd-Warshall).
