import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three';
import { ChunkStream } from './chunk-stream';
import { getMapGesture, type MapTouch } from './map-gesture';

type LocationChunkViewerProps = {
  chunkUrl: string;
};

type ViewerStatus = 'loading' | 'ready' | 'error';

type OrbitState = {
  azimuth: number;
  elevation: number;
  // Half the visible map height, in metres (orthographic zoom).
  distance: number;
  minDistance: number;
  maxDistance: number;
  target: THREE.Vector3;
};

type RenderContext = {
  gl: ExpoWebGLRenderingContext;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
};

const MIN_ORBIT_ELEVATION = THREE.MathUtils.degToRad(25);
const MAX_ORBIT_ELEVATION = Math.PI / 2 - 0.04;
const INITIAL_ORBIT_ELEVATION = THREE.MathUtils.degToRad(80);
const ORBIT_SENSITIVITY = 0.01;
const ZOOM_STEP = 1.1;

function updateOrbitCamera(camera: THREE.OrthographicCamera, orbit: OrbitState, aspect: number) {
  // Zoom changes the projection extent, independently of camera position.
  camera.left = -orbit.distance * aspect;
  camera.right = orbit.distance * aspect;
  camera.top = orbit.distance;
  camera.bottom = -orbit.distance;
  camera.updateProjectionMatrix();
  const cameraDistance = camera.far * 0.4;
  const horizontalDistance = Math.cos(orbit.elevation) * cameraDistance;

  camera.position.set(
    orbit.target.x + Math.sin(orbit.azimuth) * horizontalDistance,
    orbit.target.y + Math.sin(orbit.elevation) * cameraDistance,
    orbit.target.z + Math.cos(orbit.azimuth) * horizontalDistance,
  );
  camera.lookAt(orbit.target);
}

function ensureThreeRuntimeGlobals() {
  if (typeof navigator === 'undefined' || typeof navigator.userAgent === 'string') {
    return;
  }

  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: 'React Native',
  });
}

function createRenderer(gl: ExpoWebGLRenderingContext) {
  if (Platform.OS === 'web') {
    const webContext = gl as unknown as WebGLRenderingContext;
    const webCanvas = webContext.canvas as HTMLCanvasElement;

    return new THREE.WebGLRenderer({
      canvas: webCanvas,
      context: webContext,
      antialias: true,
      alpha: false,
      precision: 'mediump',
    });
  }

  const canvas = {
    width: gl.drawingBufferWidth,
    height: gl.drawingBufferHeight,
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    getContext: () => gl,
    clientWidth: gl.drawingBufferWidth,
    clientHeight: gl.drawingBufferHeight,
  } as unknown as HTMLCanvasElement;

  const versionEnum = 0x1f02;
  const scissorBoxEnum = 0x0c10;
  const viewportEnum = 0x0ba2;
  const nativeGetParameter = gl.getParameter.bind(gl);
  const nativeGetShaderPrecisionFormat =
    typeof gl.getShaderPrecisionFormat === 'function' ? gl.getShaderPrecisionFormat.bind(gl) : null;
  const width = Math.max(gl.drawingBufferWidth, 1);
  const height = Math.max(gl.drawingBufferHeight, 1);

  const getParameter = (parameter: number) => {
    let value: unknown;

    try {
      value = nativeGetParameter(parameter);
    } catch {
      value = undefined;
    }

    if (value !== undefined && value !== null) {
      return value;
    }

    if (parameter === versionEnum) {
      return 'WebGL 1.0';
    }

    if (parameter === scissorBoxEnum || parameter === viewportEnum) {
      return [0, 0, width, height];
    }

    return value;
  };

  const getShaderPrecisionFormat = (shaderType: number, precisionType: number) => {
    let format: Partial<WebGLShaderPrecisionFormat> | undefined;

    try {
      format = nativeGetShaderPrecisionFormat?.(shaderType, precisionType) as
        | Partial<WebGLShaderPrecisionFormat>
        | undefined;
    } catch {
      format = undefined;
    }

    if (format && typeof format.precision === 'number') {
      return format as WebGLShaderPrecisionFormat;
    }

    return {
      rangeMin: 1,
      rangeMax: 1,
      precision: 1,
    } as WebGLShaderPrecisionFormat;
  };

  // expo-gl exposes the WebGL context as a native host object. Assigning
  // methods or constants directly to that object is not reliable on Hermes,
  // so Three.js receives a proxy with the browser-facing pieces it expects.
  const compatibleContext = new Proxy(gl, {
    get(target, property) {
      if (property === 'VERSION') {
        return Reflect.get(target, property, target) ?? versionEnum;
      }

      if (property === 'SCISSOR_BOX') {
        return Reflect.get(target, property, target) ?? scissorBoxEnum;
      }

      if (property === 'VIEWPORT') {
        return Reflect.get(target, property, target) ?? viewportEnum;
      }

      if (property === 'getParameter') {
        return getParameter;
      }

      if (property === 'getShaderPrecisionFormat') {
        return getShaderPrecisionFormat;
      }

      if (property === 'canvas') {
        return canvas;
      }

      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as unknown as ExpoWebGLRenderingContext;

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
      context: compatibleContext as unknown as WebGLRenderingContext,
      antialias: true,
      alpha: false,
      precision: 'mediump',
    });
  } finally {
    console.warn = previousWarn;
  }
}

export function LocationChunkViewer(props: LocationChunkViewerProps) {
  return <ChunkViewerSession key={props.chunkUrl} {...props} />;
}

function ChunkViewerSession({ chunkUrl }: LocationChunkViewerProps) {
  const [status, setStatus] = useState<ViewerStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const streamRef = useRef<ChunkStream | null>(null);
  const [markers, setMarkers] = useState<{ key: string; x: number; y: number; failed: boolean }[]>([]);
  const [mode, setMode] = useState<'move' | 'rotate'>('move');
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  const frameSize = useRef({ width: 1, height: 320 });
  const previousTouches = useRef<MapTouch[]>([]);
  const renderContextRef = useRef<RenderContext | null>(null);
  const orbitRef = useRef<OrbitState>({
    azimuth: 0,
    elevation: INITIAL_ORBIT_ELEVATION,
    distance: 1,
    minDistance: 0.35,
    maxDistance: 4,
    target: new THREE.Vector3(),
  });
  const loadIdRef = useRef(0);
  const [webCanvas, setWebCanvas] = useState<HTMLCanvasElement | null>(null);

  const cleanup = useCallback(() => {
    loadIdRef.current += 1;

    streamRef.current?.dispose();
    streamRef.current = null;
    sceneRef.current?.traverse((object) => {
      if (object instanceof THREE.GridHelper) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });

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

    const aspect = frameSize.current.width / Math.max(frameSize.current.height, 1);
    // Expo can resize the canvas after context creation; keep Three's viewport
    // in sync or part of the drawing buffer is left outside the rendered map.
    const width = Math.max(renderContext.gl.drawingBufferWidth, 1);
    const height = Math.max(renderContext.gl.drawingBufferHeight, 1);
    renderContext.renderer.setViewport(0, 0, width, height);
    renderContext.renderer.setScissorTest(false);
    updateOrbitCamera(renderContext.camera, orbitRef.current, aspect);
    streamRef.current?.update(orbitRef.current.target, orbitRef.current.distance / 0.45, aspect);
    renderContext.renderer.render(renderContext.scene, renderContext.camera);
    renderContext.gl.endFrameEXP();
    setMarkers((streamRef.current?.markers ?? []).flatMap((marker) => {
      const projected = marker.position.clone().project(renderContext.camera);
      if (projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1) return [];
      return [{ key: marker.key, x: (projected.x + 1) * frameSize.current.width / 2,
        y: (1 - projected.y) * frameSize.current.height / 2, failed: marker.failed }];
    }));
  }, []);

  const moveCamera = useCallback((right: number, forward: number) => {
    const orbit = orbitRef.current;
    const cos = Math.cos(orbit.azimuth), sin = Math.sin(orbit.azimuth);
    orbit.target.x += right * cos + forward * sin;
    orbit.target.z += -right * sin + forward * cos;
    renderCurrentFrame();
  }, [renderCurrentFrame]);

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

  const tiltCamera = useCallback((dx: number, dy: number) => {
    const orbit = orbitRef.current;
    orbit.azimuth += dx * ORBIT_SENSITIVITY;
    orbit.elevation = THREE.MathUtils.clamp(orbit.elevation - dy * ORBIT_SENSITIVITY,
      MIN_ORBIT_ELEVATION, MAX_ORBIT_ELEVATION);
    renderCurrentFrame();
  }, [renderCurrentFrame]);

  const applyGesture = useCallback((touches: MapTouch[], rotate = false) => {
    const delta = getMapGesture(previousTouches.current, touches);
    previousTouches.current = touches;
    if (!delta) return;
    if (delta.twoFingers) {
      const orbit = orbitRef.current;
      orbit.distance = THREE.MathUtils.clamp(orbit.distance * delta.zoom, orbit.minDistance, orbit.maxDistance);
      tiltCamera(delta.dx, delta.dy);
    } else if (rotate || modeRef.current === 'rotate') {
      tiltCamera(delta.dx, delta.dy);
    } else {
      const orbit = orbitRef.current;
      const scale = 2 * orbit.distance / Math.max(frameSize.current.height, 1);
      moveCamera(-delta.dx * scale, -delta.dy * scale / Math.sin(orbit.elevation));
    }
  }, [moveCamera, tiltCamera]);

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

    let lastWheelTime = -Infinity;
    let trackpadDrag = false;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      // Browsers send trackpad two-finger drags as pixel wheel events; pinch
      // events carry ctrlKey. Keep the classification for the entire gesture.
      if (event.timeStamp - lastWheelTime > 180) {
        trackpadDrag = event.deltaMode === 0 && (Math.abs(event.deltaX) > 0 || Math.abs(event.deltaY) < 50);
      }
      lastWheelTime = event.timeStamp;
      if (!event.ctrlKey && !event.metaKey && (event.shiftKey || trackpadDrag)) {
        tiltCamera(event.deltaX, THREE.MathUtils.clamp(event.deltaY, -40, 40));
        return;
      }
      const wheelDirection = THREE.MathUtils.clamp(event.deltaY / 100, -1, 1);
      zoomCamera(Math.pow(ZOOM_STEP, wheelDirection));
    };

    const focusMap = () => webCanvas.focus({ preventScroll: true });
    const pointers = new Map<number, MapTouch>();
    let rotatePointer = false;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 2) return;
      event.preventDefault();
      focusMap();
      rotatePointer = event.button === 2 || event.shiftKey;
      pointers.set(event.pointerId, { id: event.pointerId, x: event.clientX, y: event.clientY });
      previousTouches.current = [...pointers.values()];
      webCanvas.setPointerCapture(event.pointerId);
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      event.preventDefault();
      pointers.set(event.pointerId, { id: event.pointerId, x: event.clientX, y: event.clientY });
      applyGesture([...pointers.values()], rotatePointer || event.shiftKey);
    };
    const handlePointerEnd = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      previousTouches.current = [...pointers.values()];
      if (webCanvas.hasPointerCapture(event.pointerId)) webCanvas.releasePointerCapture(event.pointerId);
    };
    const handleContextMenu = (event: Event) => event.preventDefault();
    const oldTouchAction = webCanvas.style.touchAction;
    webCanvas.style.setProperty('touch-action', 'none');
    let resizeFrame = 0;
    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(renderCurrentFrame);
    });
    resizeObserver.observe(webCanvas);
    const handleKey = (event: KeyboardEvent) => {
      const directions: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0],
        ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1],
      };
      const direction = directions[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (!direction || event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      const step = orbitRef.current.distance * 0.045;
      moveCamera(direction[0] * step, direction[1] * step);
    };
    webCanvas.setAttribute('tabindex', '0');
    webCanvas.setAttribute('aria-label', 'Mapa 3D. Usa las flechas o WASD para moverte.');
    webCanvas.addEventListener('pointerdown', handlePointerDown);
    webCanvas.addEventListener('pointermove', handlePointerMove);
    webCanvas.addEventListener('pointerup', handlePointerEnd);
    webCanvas.addEventListener('pointercancel', handlePointerEnd);
    webCanvas.addEventListener('lostpointercapture', handlePointerEnd);
    webCanvas.addEventListener('contextmenu', handleContextMenu);
    webCanvas.addEventListener('keydown', handleKey);

    webCanvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      webCanvas.removeEventListener('wheel', handleWheel);
      webCanvas.removeEventListener('pointerdown', handlePointerDown);
      webCanvas.removeEventListener('pointermove', handlePointerMove);
      webCanvas.removeEventListener('pointerup', handlePointerEnd);
      webCanvas.removeEventListener('pointercancel', handlePointerEnd);
      webCanvas.removeEventListener('lostpointercapture', handlePointerEnd);
      webCanvas.removeEventListener('contextmenu', handleContextMenu);
      webCanvas.style.setProperty('touch-action', oldTouchAction);
      resizeObserver.disconnect();
      cancelAnimationFrame(resizeFrame);
      previousTouches.current = [];
      webCanvas.removeEventListener('keydown', handleKey);
    };
  }, [webCanvas, zoomCamera, moveCamera, tiltCamera, applyGesture, renderCurrentFrame]);

  const [panResponder, setPanResponder] = useState<ReturnType<typeof PanResponder.create> | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const points = (touches: readonly { identifier: string; pageX: number; pageY: number }[]) =>
      touches.map((touch) => ({ id: touch.identifier, x: touch.pageX, y: touch.pageY }));
    const responder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => { previousTouches.current = points(event.nativeEvent.touches); },
      onPanResponderStart: (event) => { previousTouches.current = points(event.nativeEvent.touches); },
      onPanResponderMove: (event) => applyGesture(points(event.nativeEvent.touches)),
      onPanResponderEnd: (event) => { previousTouches.current = points(event.nativeEvent.touches); },
      onPanResponderRelease: () => { previousTouches.current = []; },
      onPanResponderTerminate: () => { previousTouches.current = []; },
    });
    setPanResponder(responder);
  }, [applyGesture]);

  const handleContextCreate = useCallback(
    (gl: ExpoWebGLRenderingContext) => {
      cleanup();
      if (Platform.OS === 'web') {
        setWebCanvas((gl as unknown as WebGLRenderingContext).canvas as HTMLCanvasElement);
      }
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

      const aspect = width / height;
      const camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.01, 100000);
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
          ensureThreeRuntimeGlobals();
          const stream = new ChunkStream(chunkUrl, renderCurrentFrame);
          streamRef.current = stream;
          const size = await stream.initialize();
          if (loadId !== loadIdRef.current || !size) return;
          const horizontalSize = stream.tileSize;
          scene.add(stream.root);
          const grid = new THREE.GridHelper(horizontalSize * 7, 7 * 8, 0x54708f, 0x304158);
          grid.position.y = -0.05;
          scene.add(grid);

          const viewSize = Math.max(size.z + size.y, size.x / aspect, 0.001);
          const distance = viewSize * 0.5 * 1.15;
          camera.near = 0.01;
          camera.far = Math.max(distance * 8 + size.y + horizontalSize * 8, 100);
          orbitRef.current = {
            azimuth: 0,
            elevation: INITIAL_ORBIT_ELEVATION,
            distance,
            minDistance: distance * 0.35,
            maxDistance: distance * 4,
            target: new THREE.Vector3(0, 0, 0),
          };
          updateOrbitCamera(camera, orbitRef.current, aspect);
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
    [chunkUrl, renderCurrentFrame, cleanup],
  );

  return (
    <View style={styles.card}>
      <View style={styles.viewerFrame} onLayout={(event) => {
        frameSize.current = event.nativeEvent.layout;
        const context = renderContextRef.current;
        if (context) {
          renderCurrentFrame();
        }
      }}>
        <GLView
          {...(panResponder?.panHandlers ?? {})}
          nativeRef_EXPERIMENTAL={setNativeViewRef}
          style={StyleSheet.absoluteFill}
          onContextCreate={handleContextCreate}
        />

        {markers.map((marker) => (
          <View key={marker.key} pointerEvents="none" style={[styles.chunkMarker, { left: marker.x - 55, top: marker.y - 20 }]}>
            {!marker.failed && <ActivityIndicator color="#ffffff" size="small" />}
            <Text style={styles.markerText}>{marker.failed ? 'Error de carga' : 'Cargando zona…'}</Text>
          </View>
        ))}

        {status === 'ready' && (
          <View style={styles.modeControls}>
            {(['move', 'rotate'] as const).map((value) => (
              <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: mode === value }}
                onPress={() => setMode(value)} style={[styles.modeButton, mode === value && styles.activeMode]}>
                <Text style={styles.markerText}>{value === 'move' ? 'Mover' : 'Girar'}</Text>
              </Pressable>
            ))}
          </View>
        )}
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
        Arrastra para {mode === 'move' ? 'mover el mapa' : 'girar la cámara'}. Dos dedos: arrastra para inclinar; pellizca para zoom.{`\n`}
        {Platform.OS === 'web' ? 'Flechas/WASD: mover. Trackpad: dos dedos inclinan, pellizco hace zoom. Ratón: botón derecho o Mayús + rueda para inclinar.' : 'Los chunks vecinos se cargan al explorar el mapa.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chunkMarker: { position: 'absolute', width: 110, padding: 8, borderRadius: 8, alignItems: 'center', backgroundColor: 'rgba(20,32,51,0.9)' },
  markerText: { color: '#ffffff', fontSize: 12, textAlign: 'center' },
  modeControls: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', gap: 6 },
  modeButton: { padding: 10, borderRadius: 8, backgroundColor: '#24364d' },
  activeMode: { backgroundColor: '#356caa' },
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
