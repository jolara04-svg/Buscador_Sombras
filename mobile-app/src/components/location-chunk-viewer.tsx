import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

type LocationChunkViewerProps = {
  chunkUrl: string;
};

type ViewerStatus = 'loading' | 'ready' | 'error';

function createRenderer(gl: ExpoWebGLRenderingContext) {
  const canvas = {
    width: gl.drawingBufferWidth,
    height: gl.drawingBufferHeight,
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    clientHeight: gl.drawingBufferHeight,
  } as unknown as HTMLCanvasElement;

  return new THREE.WebGLRenderer({
    canvas,
    context: gl as unknown as WebGLRenderingContext,
    antialias: true,
    alpha: false,
  });
}

function disposeModel(model: THREE.Object3D) {
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;

    if (!mesh.isMesh) {
      return;
    }

    mesh.geometry.dispose();

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => material.dispose());
  });
}

export function LocationChunkViewer({ chunkUrl }: LocationChunkViewerProps) {
  const [status, setStatus] = useState<ViewerStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const loadIdRef = useRef(0);

  const cleanup = useCallback(() => {
    loadIdRef.current += 1;

    if (modelRef.current) {
      disposeModel(modelRef.current);
      modelRef.current = null;
    }

    sceneRef.current = null;
    rendererRef.current?.dispose();
    rendererRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const handleContextCreate = useCallback(
    (gl: ExpoWebGLRenderingContext) => {
      const loadId = loadIdRef.current + 1;
      loadIdRef.current = loadId;
      setStatus('loading');
      setErrorMessage('');

      const width = Math.max(gl.drawingBufferWidth, 1);
      const height = Math.max(gl.drawingBufferHeight, 1);
      const renderer = createRenderer(gl);

      renderer.setPixelRatio(1);
      renderer.setSize(width, height, false);
      renderer.setClearColor('#142033');
      renderer.shadowMap.enabled = false;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#142033');

      const camera = new THREE.PerspectiveCamera(42, width / height, 0.01, 100000);
      camera.up.set(0, 0, -1);

      scene.add(new THREE.HemisphereLight(0xdcecff, 0x2c3444, 2.2));

      const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
      keyLight.position.set(5, 8, 6);
      keyLight.castShadow = false;
      scene.add(keyLight);

      rendererRef.current = renderer;
      sceneRef.current = scene;

      const loadChunk = async () => {
        try {
          const response = await fetch(chunkUrl);

          if (!response.ok) {
            let detail = `HTTP ${response.status}`;

            try {
              const payload = (await response.json()) as { error?: string };
              if (payload.error) {
                detail = payload.error;
              }
            } catch {
              // Keep the HTTP status when the backend response is not JSON.
            }

            throw new Error(detail);
          }

          const data = await response.arrayBuffer();
          const loader = new GLTFLoader();
          const gltf = await new Promise<GLTF>((resolve, reject) => {
            loader.parse(data, chunkUrl, resolve, reject);
          });

          if (loadId !== loadIdRef.current) {
            return;
          }

          const model = gltf.scene;

          // The source dataset is Z-Up, while Three.js uses Y-Up.
          model.rotation.x = -Math.PI / 2;
          model.updateMatrixWorld(true);

          const bounds = new THREE.Box3().setFromObject(model);

          if (bounds.isEmpty()) {
            throw new Error('El chunk 3D no contiene geometría visible.');
          }

          const size = bounds.getSize(new THREE.Vector3());
          const center = bounds.getCenter(new THREE.Vector3());
          const horizontalSize = Math.max(size.x, size.z, 0.001);

          // Center the chunk horizontally and place its lowest point on the ground.
          model.position.x -= center.x;
          model.position.y -= bounds.min.y;
          model.position.z -= center.z;
          model.updateMatrixWorld(true);

          model.traverse((object) => {
            const mesh = object as THREE.Mesh;
            if (mesh.isMesh) {
              mesh.castShadow = false;
              mesh.receiveShadow = false;
            }
          });

          const grid = new THREE.GridHelper(horizontalSize * 1.15, 16, 0x54708f, 0x304158);
          grid.position.y = 0;
          scene.add(grid);
          scene.add(model);
          modelRef.current = model;

          const viewSize = Math.max(size.z, size.x / camera.aspect, 0.001);
          const distance =
            (viewSize / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))) * 1.15;
          camera.near = 0.01;
          camera.far = Math.max(distance + size.y + horizontalSize * 2, 100);
          camera.position.set(0, distance, 0);
          camera.lookAt(0, 0, 0);
          camera.updateProjectionMatrix();

          setStatus('ready');

          if (loadId !== loadIdRef.current) {
            return;
          }

          renderer.render(scene, camera);
          gl.endFrameEXP();
        } catch (error) {
          if (loadId !== loadIdRef.current) {
            return;
          }

          setStatus('error');
          setErrorMessage(error instanceof Error ? error.message : 'No se pudo cargar el chunk 3D.');
        }
      };

      void loadChunk();
    },
    [chunkUrl],
  );

  return (
    <View style={styles.card}>
      <View style={styles.viewerFrame}>
        <GLView style={StyleSheet.absoluteFill} onContextCreate={handleContextCreate} />

        {status === 'loading' && (
          <View style={styles.overlay} pointerEvents="none">
            <ActivityIndicator color="#ffffff" size="large" />
            <Text style={styles.overlayText}>Cargando edificios 3D...</Text>
          </View>
        )}

        {status === 'error' && (
          <View style={styles.overlay} pointerEvents="none">
            <Text style={styles.errorTitle}>No se pudo cargar la vista 3D</Text>
            <Text style={styles.overlayText}>{errorMessage}</Text>
          </View>
        )}
      </View>

      <Text style={styles.caption}>Chunk de edificios de la ubicación seleccionada</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 20,
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: '#142033',
  },
  viewerFrame: {
    height: 320,
    overflow: 'hidden',
    backgroundColor: '#142033',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(20, 32, 51, 0.86)',
  },
  overlayText: {
    marginTop: 12,
    color: '#e8f1ff',
    fontSize: 14,
    textAlign: 'center',
  },
  errorTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  caption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#b9c9de',
    fontSize: 13,
    textAlign: 'center',
  },
});
