import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

type LocationChunkViewerProps = {
  chunkUrl: string;
};

type ViewerStatus = 'loading' | 'ready' | 'error';

type OrbitState = {
  azimuth: number;
  elevation: number;
  distance: number;
  minDistance: number;
  maxDistance: number;
  target: THREE.Vector3;
};

type RenderContext = {
  gl: ExpoWebGLRenderingContext;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
};

const MIN_ORBIT_ELEVATION = 0.25;
const MAX_ORBIT_ELEVATION = Math.PI / 2 - 0.04;
const ORBIT_SENSITIVITY = 0.01;
const ZOOM_STEP = 1.1;

function getTouchDistance(touches: readonly { pageX: number; pageY: number }[]) {
  if (touches.length < 2) {
    return null;
  }

  const [firstTouch, secondTouch] = touches;
  return Math.hypot(secondTouch.pageX - firstTouch.pageX, secondTouch.pageY - firstTouch.pageY);
}

function updateOrbitCamera(camera: THREE.PerspectiveCamera, orbit: OrbitState) {
  const horizontalDistance = Math.cos(orbit.elevation) * orbit.distance;

  camera.position.set(
    orbit.target.x + Math.sin(orbit.azimuth) * horizontalDistance,
    orbit.target.y + Math.sin(orbit.elevation) * orbit.distance,
    orbit.target.z + Math.cos(orbit.azimuth) * horizontalDistance,
  );
  camera.lookAt(orbit.target);
}

function ensureShaderPrecisionSupport(gl: ExpoWebGLRenderingContext) {
  const nativeGetShaderPrecisionFormat =
    typeof gl.getShaderPrecisionFormat === 'function' ? gl.getShaderPrecisionFormat.bind(gl) : null;

  gl.getShaderPrecisionFormat = ((shaderType: number, precisionType: number) => {
    const format = nativeGetShaderPrecisionFormat?.(shaderType, precisionType) as
      | Partial<WebGLShaderPrecisionFormat>
      | undefined;

    if (format && typeof format.precision === 'number') {
      return format as WebGLShaderPrecisionFormat;
    }

    return {
      rangeMin: 1,
      rangeMax: 1,
      precision: 1,
    } as WebGLShaderPrecisionFormat;
  }) as typeof gl.getShaderPrecisionFormat;
}

function ensureExpoGlCompatibility(gl: ExpoWebGLRenderingContext) {
  ensureShaderPrecisionSupport(gl);

  const nativeGetParameter = gl.getParameter.bind(gl);
  const versionEnum = typeof gl.VERSION === 'number' ? gl.VERSION : 0x1f02;
  const scissorBoxEnum = typeof gl.SCISSOR_BOX === 'number' ? gl.SCISSOR_BOX : 0x0c10;
  const viewportEnum = typeof gl.VIEWPORT === 'number' ? gl.VIEWPORT : 0x0ba2;
  const width = Math.max(gl.drawingBufferWidth, 1);
  const height = Math.max(gl.drawingBufferHeight, 1);

  gl.getParameter = ((parameter: number) => {
    const value = nativeGetParameter(parameter);

    if (value !== undefined && value !== null) {
      return value;
    }

    // expo-gl can return undefined for values that Three.js expects from a browser WebGL context.
    if (parameter === versionEnum) {
      return 'WebGL 1.0';
    }

    if (parameter === scissorBoxEnum || parameter === viewportEnum) {
      return [0, 0, width, height];
    }

    return value;
  }) as typeof gl.getParameter;
}

function createRenderer(gl: ExpoWebGLRenderingContext) {
  ensureExpoGlCompatibility(gl);

  const canvas = {
    width: gl.drawingBufferWidth,
    height: gl.drawingBufferHeight,
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    clientHeight: gl.drawingBufferHeight,
  } as unknown as HTMLCanvasElement;

  const previousWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const message = args[0];

    if (message === 'THREE.WebGLRenderer: WebGL 1 support was deprecated in r153 and will be removed in r163.') {
      return;
    }

    previousWarn(...args);
  };

  try {
    return new THREE.WebGLRenderer({
      canvas,
      context: gl as unknown as WebGLRenderingContext,
      antialias: true,
      alpha: false,
      precision: 'mediump',
    });
  } finally {
    console.warn = previousWarn;
  }
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
  const renderContextRef = useRef<RenderContext | null>(null);
  const orbitRef = useRef<OrbitState>({
    azimuth: 0,
    elevation: MAX_ORBIT_ELEVATION,
    distance: 1,
    minDistance: 0.35,
    maxDistance: 4,
    target: new THREE.Vector3(),
  });
  const dragStartRef = useRef({ azimuth: 0, elevation: MAX_ORBIT_ELEVATION });
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartOrbitDistanceRef = useRef(1);
  const loadIdRef = useRef(0);
  const [webCanvas, setWebCanvas] = useState<HTMLCanvasElement | null>(null);

  const cleanup = useCallback(() => {
    loadIdRef.current += 1;

    if (modelRef.current) {
      disposeModel(modelRef.current);
      modelRef.current = null;
    }

    sceneRef.current = null;
    renderContextRef.current = null;
    rendererRef.current?.dispose();
    rendererRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const renderCurrentFrame = useCallback(() => {
    const renderContext = renderContextRef.current;

    if (!renderContext) {
      return;
    }

    updateOrbitCamera(renderContext.camera, orbitRef.current);
    renderContext.renderer.render(renderContext.scene, renderContext.camera);
    renderContext.gl.endFrameEXP();
  }, []);

  const zoomCamera = useCallback(
    (factor: number) => {
      const orbit = orbitRef.current;
      orbit.distance = THREE.MathUtils.clamp(
        orbit.distance * factor,
        orbit.minDistance,
        orbit.maxDistance,
      );
      renderCurrentFrame();
    },
    [renderCurrentFrame],
  );

  const setNativeViewRef = useCallback((nativeRef: unknown) => {
    if (Platform.OS !== 'web' || typeof HTMLCanvasElement === 'undefined') {
      return;
    }

    setWebCanvas(nativeRef instanceof HTMLCanvasElement ? nativeRef : null);
  }, []);

  useEffect(() => {
    if (!webCanvas) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();

      const wheelDirection = THREE.MathUtils.clamp(event.deltaY / 100, -1, 1);
      zoomCamera(Math.pow(ZOOM_STEP, wheelDirection));
    };

    webCanvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => webCanvas.removeEventListener('wheel', handleWheel);
  }, [webCanvas, zoomCamera]);

  const [panResponder, setPanResponder] = useState<ReturnType<typeof PanResponder.create> | null>(null);

  useEffect(() => {
    const responder = PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const horizontalDrag =
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 8;
        const twoFingerDrag =
          gestureState.numberActiveTouches >= 2 &&
          Math.max(Math.abs(gestureState.dx), Math.abs(gestureState.dy)) > 8;

        return horizontalDrag || twoFingerDrag;
      },
      onPanResponderGrant: (event) => {
        dragStartRef.current = {
          azimuth: orbitRef.current.azimuth,
          elevation: orbitRef.current.elevation,
        };

        const touchDistance = getTouchDistance(event.nativeEvent.touches);
        pinchStartDistanceRef.current = touchDistance;
        pinchStartOrbitDistanceRef.current = orbitRef.current.distance;
      },
      onPanResponderMove: (event, gestureState) => {
        const touchDistance = getTouchDistance(event.nativeEvent.touches);

        if (touchDistance) {
          if (!pinchStartDistanceRef.current) {
            pinchStartDistanceRef.current = touchDistance;
            pinchStartOrbitDistanceRef.current = orbitRef.current.distance;
          }

          orbitRef.current.distance = THREE.MathUtils.clamp(
            (pinchStartOrbitDistanceRef.current * pinchStartDistanceRef.current) / touchDistance,
            orbitRef.current.minDistance,
            orbitRef.current.maxDistance,
          );
          renderCurrentFrame();
          return;
        }

        pinchStartDistanceRef.current = null;
        orbitRef.current.azimuth = dragStartRef.current.azimuth + gestureState.dx * ORBIT_SENSITIVITY;
        orbitRef.current.elevation = THREE.MathUtils.clamp(
          dragStartRef.current.elevation - gestureState.dy * ORBIT_SENSITIVITY,
          MIN_ORBIT_ELEVATION,
          MAX_ORBIT_ELEVATION,
        );
        renderCurrentFrame();
      },
      onPanResponderRelease: () => {
        pinchStartDistanceRef.current = null;
        renderCurrentFrame();
      },
      onPanResponderTerminate: () => {
        pinchStartDistanceRef.current = null;
        renderCurrentFrame();
      },
    });

    setPanResponder(responder);
  }, [renderCurrentFrame]);

  const handleContextCreate = useCallback(
    (gl: ExpoWebGLRenderingContext) => {
      const loadId = loadIdRef.current + 1;
      loadIdRef.current = loadId;
      setStatus('loading');
      setErrorMessage('');

      const width = Math.max(gl.drawingBufferWidth, 1);
      const height = Math.max(gl.drawingBufferHeight, 1);
      let renderer: THREE.WebGLRenderer;

      try {
        renderer = createRenderer(gl);
      } catch (error) {
        setStatus('error');
        setErrorMessage(
          error instanceof Error ? error.message : 'No se pudo inicializar el renderizador 3D.',
        );
        return;
      }

      renderer.setPixelRatio(1);
      renderer.setSize(width, height, false);
      renderer.setClearColor('#142033');
      renderer.shadowMap.enabled = false;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#142033');

      const camera = new THREE.PerspectiveCamera(42, width / height, 0.01, 100000);
      camera.up.set(0, 1, 0);

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
          orbitRef.current = {
            azimuth: 0,
            elevation: MAX_ORBIT_ELEVATION,
            distance,
            minDistance: distance * 0.35,
            maxDistance: distance * 4,
            target: new THREE.Vector3(0, 0, 0),
          };
          updateOrbitCamera(camera, orbitRef.current);
          camera.updateProjectionMatrix();
          renderContextRef.current = { gl, renderer, scene, camera };

          setStatus('ready');

          if (loadId !== loadIdRef.current) {
            return;
          }

          renderCurrentFrame();
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
    [chunkUrl, renderCurrentFrame],
  );

  return (
    <View style={styles.card}>
      <View style={styles.viewerFrame}>
        <GLView
          {...(panResponder?.panHandlers ?? {})}
          nativeRef_EXPERIMENTAL={setNativeViewRef}
          style={StyleSheet.absoluteFill}
          onContextCreate={handleContextCreate}
        />

        {status === 'ready' && (
          <View style={styles.zoomControls}>
            <Pressable
              accessibilityLabel="Acercar mapa"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => zoomCamera(1 / ZOOM_STEP)}
              style={styles.zoomButton}>
              <Text style={styles.zoomButtonText}>+</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Alejar mapa"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => zoomCamera(ZOOM_STEP)}
              style={styles.zoomButton}>
              <Text style={styles.zoomButtonText}>−</Text>
            </Pressable>
          </View>
        )}

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

      <Text style={styles.caption}>
        Chunk de edificios de la ubicación seleccionada{`\n`}Desliza horizontalmente para girar la cámara
      </Text>
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
  zoomControls: {
    position: 'absolute',
    top: 12,
    right: 12,
    gap: 8,
  },
  zoomButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(232, 241, 255, 0.35)',
    borderRadius: 21,
    backgroundColor: 'rgba(20, 32, 51, 0.88)',
  },
  zoomButtonText: {
    color: '#ffffff',
    fontSize: 27,
    fontWeight: '500',
    lineHeight: 30,
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
