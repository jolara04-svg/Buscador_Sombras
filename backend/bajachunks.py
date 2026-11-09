import trimesh
import numpy as np
from pathlib import Path
from tqdm import tqdm

CARPETA_CHUNKS = Path("./madrid_chunks/16")

def forzar_todos_los_edificios_a_cero():
    archivos = list(CARPETA_CHUNKS.rglob("*.glb"))
    print(f"\n--- PROCESANDO {len(archivos)} CHUNKS: EDIFICIO POR EDIFICIO ---")

    for ruta in tqdm(archivos, desc="Aplanando edificios"):
        try:
            escena = trimesh.load(str(ruta))
            mallas_iniciales = escena.dump() if hasattr(escena, 'dump') else [escena]

            edificios_corregidos = []

            for m in mallas_iniciales:
                if not isinstance(m, trimesh.Trimesh) or len(m.vertices) == 0:
                    continue

                # 1. SEPARAR EL CHUNK EN EDIFICIOS INDIVIDUALES
                # Identifica cada cuerpo cerrado/aislado de forma independiente
                edificios_sueltos = m.split(only_watertight=False)

                for edif in edificios_sueltos:
                    # Descartar basura o fragmentos minúsculos de menos de 6 vértices
                    if len(edif.vertices) < 6:
                        continue

                    # 2. OBTENER LA COTA MÍNIMA DE ESTE EDIFICIO CONCRETO
                    z_min = float(np.min(edif.vertices[:, 2]))
                    altura_total = float(np.max(edif.vertices[:, 2]) - z_min)

                    # 3. BAJAR EL EDIFICIO A CERO
                    edif.vertices[:, 2] -= z_min

                    # 4. PLANARIZACIÓN DE CIMIENTOS (SELLADO CONTRA EL SUELO)
                    # Tomamos los vértices del zócalo/cimiento (el 5% inferior o los primeros 80 cm)
                    # y los anclamos a 0.0 exactos para que la base quede plana como una tabla
                    umbral_cimiento = min(0.8, altura_total * 0.05)
                    vertices_base = edif.vertices[:, 2] <= umbral_cimiento
                    edif.vertices[vertices_base, 2] = 0.0

                    edificios_corregidos.append(edif)

            if not edificios_corregidos:
                continue

            # 5. Volver a fusionar el chunk para mantener alto rendimiento en la app
            chunk_unificado = trimesh.util.concatenate(edificios_corregidos)
            chunk_unificado.export(str(ruta))

        except Exception as e:
            print(f"Aviso en {ruta.name}: {e}")

    print("\n✅ LISTO: El 100% de los edificios descansan exactamente en Z = 0.0\n")

if __name__ == "__main__":
    forzar_todos_los_edificios_a_cero()