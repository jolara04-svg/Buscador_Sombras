import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Mapa2D, type Mapa2DProps, type MapViewport } from './Mapa2D.web';
import { buildingShaderMaterial, shadowShaderMaterialDefault, getShadowCastMatrix } from './shadersSombras';
import { chunkReference, mercator, metersPerPixel } from './shadow-map-projection';
import { disposeChunk } from './chunk-stream';

type Props = Mapa2DProps & { chunkURL: string; azimuth: number; elevation: number };
type Overlay = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  shadow: THREE.ShaderMaterial;
  buildings: THREE.ShaderMaterial;
  reference: ReturnType<typeof chunkReference>;
};

function draw(overlay: Overlay, viewport: MapViewport) {
  if (viewport.width <= 0 || viewport.height <= 0) return;
  const { renderer, camera, scene, reference } = overlay;
  const center = mercator(viewport.centerLat, viewport.centerLon);
  const units = metersPerPixel(viewport.zoom) / reference.scale;
  camera.left = -viewport.width * units / 2;
  camera.right = -camera.left;
  camera.top = viewport.height * units / 2;
  camera.bottom = -camera.top;
  camera.position.set((center.x - reference.x) / reference.scale, (center.y - reference.y) / reference.scale, 1000);
  camera.updateProjectionMatrix();
  renderer.setSize(viewport.width, viewport.height, false);
  renderer.render(scene, camera);
}

export function ShadowMap({ chunkURL, azimuth, elevation, ...mapProps }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<Overlay | null>(null);
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const latest = useRef({ azimuth, elevation, viewport });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    latest.current = { azimuth, elevation, viewport };
  }, [azimuth, elevation, viewport]);

  useEffect(() => {
    if (!canvas.current) return;
    let active = true;
    setError(null);
    const renderer = new THREE.WebGLRenderer({ canvas: canvas.current, alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setClearColor(0, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
    const shadow = shadowShaderMaterialDefault(latest.current.azimuth, latest.current.elevation, 1);
    const buildings = buildingShaderMaterial(1);
    const state = { renderer, scene, camera, shadow, buildings, reference: chunkReference(chunkURL) };
    overlay.current = state;
    if (latest.current.viewport) draw(state, latest.current.viewport);

    void new GLTFLoader().loadAsync(chunkURL).then(gltf => {
      if (!active) { disposeChunk(gltf.scene); return; }
      gltf.scene.updateMatrixWorld(true);
      const geometries: THREE.BufferGeometry[] = [];
      gltf.scene.traverse(object => {
        if (object instanceof THREE.Mesh) geometries.push(object.geometry.clone().applyMatrix4(object.matrixWorld));
      });
      disposeChunk(gltf.scene);
      const bounds = new THREE.Box3();
      geometries.forEach(geometry => { geometry.computeBoundingBox(); bounds.union(geometry.boundingBox!); });
      geometries.forEach(geometry => {
        geometry.translate(0, 0, -bounds.min.z);
        const cast = new THREE.Mesh(geometry, shadow);
        // The shader moves vertices outside the original geometry bounds.
        cast.frustumCulled = false;
        const building = new THREE.Mesh(geometry, buildings);
        building.frustumCulled = false;
        scene.add(cast, building);
      });
      shadow.uniforms.shadowCastMatrix.value.copy(getShadowCastMatrix(latest.current.azimuth, latest.current.elevation, 1));
      shadow.uniforms.shadowColor.value.w = latest.current.elevation > 0 ? 0.5 : 0;
      if (latest.current.viewport) draw(state, latest.current.viewport);
    }).catch(() => { if (active) setError('No se pudieron cargar los edificios de esta zona.'); });

    return () => {
      active = false;
      overlay.current = null;
      const geometries = new Set<THREE.BufferGeometry>();
      scene.traverse(object => { if (object instanceof THREE.Mesh) geometries.add(object.geometry); });
      geometries.forEach(geometry => geometry.dispose());
      shadow.dispose();
      buildings.dispose();
      renderer.dispose();
    };
  }, [chunkURL]);

  useEffect(() => {
    const state = overlay.current;
    if (!state || !viewport) return;
    state.shadow.uniforms.shadowCastMatrix.value.copy(getShadowCastMatrix(azimuth, elevation, 1));
    state.shadow.uniforms.shadowColor.value.w = elevation > 0 ? 0.5 : 0;
    draw(state, viewport);
  }, [azimuth, elevation, viewport]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', flex: 1, overflow: 'hidden' }}>
      <Mapa2D {...mapProps} onViewportChange={setViewport} />
      <canvas ref={canvas} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
      {error && <div role="status" style={{ position: 'absolute', bottom: 28, left: 12, background: 'white', padding: 8 }}>{error}</div>}
    </div>
  );
}
