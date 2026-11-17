import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Mapa2D, type Mapa2DProps, type MapViewport } from './Mapa2D.web';
import { buildingShaderMaterial, shadowShaderMaterialDefault, getShadowCastMatrix } from './shadersSombras';
import { chunkReference, mercator, metersPerPixel, shadowTilesForViewport, tileOffsetFromReference, type TileCoordinate } from './shadow-map-projection';
import { disposeChunk } from './chunk-stream';
import { sourceEnabled, sourceOpacity, tileSourceUrl, type ShadowSourceSelection } from './shadow-map-sources';
import type { ShadowLayerSelection, ShadowLayerWeights } from './shadow-settings';
import { ShadowLayerControls } from './ShadowLayerControls';

type Props = Mapa2DProps & { chunkURL: string; azimuth: number; elevation: number; sources?: ShadowSourceSelection; weights?: ShadowLayerWeights; onSelectionChange?: (selection: ShadowLayerSelection) => void; onWeightChange?: (layer: 'buildings' | 'trees', value: number) => void };
type Overlay = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  shadow: THREE.ShaderMaterial;
  buildings: THREE.ShaderMaterial;
  vegetation: THREE.ShaderMaterial;
  reference: ReturnType<typeof chunkReference>;
  ensureTiles: (viewport: MapViewport) => void;
};

type ShadowSource = 'buildings' | 'trees';
type Manifest = Record<string, string[]>;

async function runWithConcurrency<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await task(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

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

export function ShadowMap({ chunkURL, azimuth, elevation, sources, weights, onSelectionChange, onWeightChange, ...mapProps }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<Overlay | null>(null);
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const latest = useRef({ azimuth, elevation, viewport, weights });
  const [error, setError] = useState<string | null>(null);

  const sourceSelectionKey = JSON.stringify(sources);

  useEffect(() => {
    latest.current = { azimuth, elevation, viewport, weights };
  }, [azimuth, elevation, viewport, weights]);

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
    const trees = shadowShaderMaterialDefault(latest.current.azimuth, latest.current.elevation, 1);
    trees.uniforms.shadowColor.value.w = 0.5 * sourceOpacity('trees', latest.current.weights);
    const state: Overlay = {
      renderer,
      scene,
      camera,
      shadow,
      buildings,
      vegetation: trees,
      reference: chunkReference(chunkURL),
      ensureTiles: () => {},
    };
    overlay.current = state;
    if (latest.current.viewport) draw(state, latest.current.viewport);

    const loader = new GLTFLoader();
    const originTile: TileCoordinate = { x: state.reference.tileX, y: state.reference.tileY, z: 16 };
    const loadedTiles = new Set<string>();
    const loadingTiles = new Set<string>();
    const manifests = new Map<ShadowSource, Manifest | null>();
    let groundZ: number | null = null;

    const materialFor = (source: ShadowSource) => source === 'trees' ? trees : shadow;
    const tileKey = (source: ShadowSource, tile: TileCoordinate) => `${source}:${tile.x}:${tile.y}`;
    const isOrigin = (tile: TileCoordinate) => tile.x === originTile.x && tile.y === originTile.y;

    const loadManifest = async (source: ShadowSource) => {
      if (manifests.has(source)) return manifests.get(source) ?? null;
      try {
        const base = new URL(chunkURL);
        const response = await fetch(`${base.origin}/manifest/${source}`);
        const manifest = response.ok ? await response.json() as Manifest : null;
        manifests.set(source, manifest);
        return manifest;
      } catch {
        manifests.set(source, null);
        return null;
      }
    };

    const hasTile = (manifest: Manifest | null, tile: TileCoordinate) =>
      manifest?.[String(tile.x)]?.includes(String(tile.y)) === true;

    const loadTile = async (source: ShadowSource, tile: TileCoordinate, manifest: Manifest | null) => {
      const key = tileKey(source, tile);
      if (!active || loadedTiles.has(key) || loadingTiles.has(key)) return;
      if (manifest ? !hasTile(manifest, tile) : !isOrigin(tile)) return;

      loadingTiles.add(key);
      try {
        const url = tileSourceUrl(chunkURL, source, tile.x, tile.y, tile.z);
        const gltf = await loader.loadAsync(url);
        if (!active) {
          disposeChunk(gltf.scene);
          return;
        }

        gltf.scene.updateMatrixWorld(true);
        const offset = tileOffsetFromReference(tile, state.reference);
        const geometries: THREE.BufferGeometry[] = [];
        const bounds = new THREE.Box3();
        gltf.scene.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
          geometry.translate(offset.x, offset.y, 0);
          geometry.computeBoundingBox();
          if (geometry.boundingBox) bounds.union(geometry.boundingBox);
          geometries.push(geometry);
        });
        disposeChunk(gltf.scene);

        if (!geometries.length || bounds.isEmpty()) return;
        if (groundZ === null) groundZ = bounds.min.z;

        geometries.forEach(geometry => {
          geometry.translate(0, 0, -groundZ!);
          const material = materialFor(source);
          const cast = new THREE.Mesh(geometry, material);
          // The shader moves vertices outside the original geometry bounds.
          cast.frustumCulled = false;
          scene.add(cast);
          if (source === 'buildings') {
            const building = new THREE.Mesh(geometry, buildings);
            building.frustumCulled = false;
            scene.add(building);
          }
        });
        loadedTiles.add(key);
        materialFor(source).uniforms.shadowCastMatrix.value.copy(getShadowCastMatrix(latest.current.azimuth, latest.current.elevation, 1));
        if (latest.current.viewport) draw(state, latest.current.viewport);
      } catch (loadError) {
        if (active && isOrigin(tile)) {
          console.warn(`No se pudo cargar el chunk central de ${source}:`, loadError);
          setError('No se pudieron cargar las capas 3D de esta zona.');
        }
      } finally {
        loadingTiles.delete(key);
      }
    };

    state.ensureTiles = (nextViewport) => {
      const tiles = shadowTilesForViewport(chunkURL, nextViewport);
      const sourcesToLoad = (['buildings', 'trees'] as const).filter(source => sourceEnabled(sources, source));
      void (async () => {
        const jobs: { source: ShadowSource; tile: TileCoordinate; manifest: Manifest | null }[] = [];
        for (const source of sourcesToLoad) {
          const manifest = await loadManifest(source);
          const available = manifest ? tiles.filter(tile => hasTile(manifest, tile)) : tiles.filter(isOrigin);
          available.forEach(tile => jobs.push({ source, tile, manifest }));
        }
        await runWithConcurrency(jobs, 4, ({ source, tile, manifest }) => loadTile(source, tile, manifest));
        if (active && latest.current.viewport) draw(state, latest.current.viewport);
      })();
    };

    if (latest.current.viewport) state.ensureTiles(latest.current.viewport);

    return () => {
      active = false;
      overlay.current = null;
      const geometries = new Set<THREE.BufferGeometry>();
      scene.traverse(object => { if (object instanceof THREE.Mesh) geometries.add(object.geometry); });
      geometries.forEach(geometry => geometry.dispose());
      shadow.dispose();
      buildings.dispose();
      state.vegetation.dispose();
      renderer.dispose();
    };
  }, [chunkURL, sourceSelectionKey, sources]);

  useEffect(() => {
    const state = overlay.current;
    if (!state || !viewport) return;
    state.ensureTiles(viewport);
    state.shadow.uniforms.shadowCastMatrix.value.copy(getShadowCastMatrix(azimuth, elevation, 1));
    state.shadow.uniforms.shadowColor.value.w = elevation > 0 ? 0.5 * sourceOpacity('buildings', weights) : 0;
    state.vegetation.uniforms.shadowCastMatrix.value.copy(getShadowCastMatrix(azimuth, elevation, 1));
    state.vegetation.uniforms.shadowColor.value.w = elevation > 0 ? 0.5 * sourceOpacity('trees', weights) : 0;
    draw(state, viewport);
  }, [azimuth, elevation, viewport, weights]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', flex: 1, overflow: 'hidden' }}>
      <Mapa2D {...mapProps} onViewportChange={setViewport} />
      <canvas ref={canvas} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
      {error && <div role="status" style={{ position: 'absolute', bottom: 28, left: 12, background: 'white', padding: 8 }}>{error}</div>}
      {sources && weights && onSelectionChange && onWeightChange && <ShadowLayerControls selection={sources} weights={weights} onSelectionChange={onSelectionChange} onWeightChange={onWeightChange} />}
    </div>
  );
}
