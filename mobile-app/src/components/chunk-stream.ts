import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

const TILE_COUNT = 2 ** 16;
export type ChunkLayer = 'buildings' | 'trees';
export type ChunkMarker = { key: string; position: THREE.Vector3; failed: boolean; layer?: ChunkLayer };

export function getChunkMarkerKey(marker: Pick<ChunkMarker, 'key' | 'layer'>) {
  return `${marker.layer ?? 'buildings'}:${marker.key}`;
}

type Entry = { model?: THREE.Object3D; marker?: ChunkMarker; controller: AbortController };

export function disposeChunk(model: THREE.Object3D) {
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material: THREE.Material) => material.dispose());
  });
}


/**
 * Clase encargada de gestionar el streaming y la carga progresiva de chunks 3D de edificios adyacentes.
 */
// Dataset coordinates are local ENU around each Slippy tile's centre, in metres.
export class ChunkStream {
  readonly root = new THREE.Group();
  readonly roots: Record<ChunkLayer, THREE.Group> = { buildings: new THREE.Group(), trees: new THREE.Group() };
  readonly origin: { x: number; y: number };
  readonly tileSize: number;
  private base: string;
  private entries = new Map<ChunkLayer, Map<string, Entry>>();
  private manifests = new Map<ChunkLayer, Record<string, string[]> | null>();
  private enabled = new Map<ChunkLayer, boolean>();
  private desired = new Set<string>();
  private queue: { layer: ChunkLayer; x: number; y: number }[] = [];
  private running = 0;
  private ground = new Map<ChunkLayer, number>();
  private active = true;


  

  /**
   * Crea una instancia de ChunkStream para la ubicación dada.
   * @param {string} url - URL de la petición del chunk inicial.
   * @param {() => void} changed - Callback de notificación de cambios para re-renderizado.
   */
constructor(url: string, private changed: () => void, options: { layers?: ChunkLayer[] } = {}) {
    const parsed = new URL(url);
    const lat = Number(parsed.searchParams.get('lat'));
    const lon = Number(parsed.searchParams.get('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('Ubicación 3D inválida.');
    const rad = lat * Math.PI / 180;
    this.origin = { x: Math.floor((lon + 180) / 360 * TILE_COUNT), y: Math.floor((1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2 * TILE_COUNT) };
    const centreLat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (this.origin.y + 0.5) / TILE_COUNT)));
    this.tileSize = 2 * Math.PI * 6378137 * Math.cos(centreLat) / TILE_COUNT;
    this.base = parsed.origin;
    for (const layer of ['buildings', 'trees'] as ChunkLayer[]) {
      this.entries.set(layer, new Map());
      this.manifests.set(layer, null);
      this.enabled.set(layer, options.layers ? options.layers.includes(layer) : layer === 'buildings');
      this.root.add(this.roots[layer]);
      this.roots[layer].visible = this.isLayerEnabled(layer);
    }
  }

  get markers() { return [...this.entries].flatMap(([layer, entries]) => [...entries.values()].flatMap((entry) => entry.marker ? [{ ...entry.marker, layer }] : [])); }
  setLayerEnabled(layer: ChunkLayer, enabled: boolean) {
    this.enabled.set(layer, enabled);
    const root = this.roots[layer];
    root.visible = enabled;
    if (!enabled) {
      const entries = this.entries.get(layer)!;
      for (const entry of entries.values()) {
        entry.controller.abort();
        if (entry.model) { root.remove(entry.model); disposeChunk(entry.model); }
      }
      entries.clear();
    }
    this.changed();
  }
  isLayerEnabled(layer: ChunkLayer) { return this.enabled.get(layer) === true; }

  async initialize() {
    const enabled = (['buildings', 'trees'] as ChunkLayer[]).filter((layer) => this.isLayerEnabled(layer));
    if (!enabled.length) return new THREE.Vector3(this.tileSize, 0, this.tileSize);
    const sizes = (await Promise.all(enabled.map(async (layer) => {
      const controller = new AbortController(); const key = `${this.origin.x}/${this.origin.y}`;
      const entry: Entry = { controller }; this.entries.get(layer)!.set(key, entry);
      try {
        await this.fetchManifest(layer, controller.signal);
        const manifest = this.manifests.get(layer);
        if (!manifest?.[String(this.origin.x)]?.includes(String(this.origin.y))) return null;
        const model = await this.fetchModel(layer, this.origin.x, this.origin.y, controller.signal);
        if (!this.active || !this.isLayerEnabled(layer)) { disposeChunk(model); return null; }
        const bounds = new THREE.Box3().setFromObject(model); if (bounds.isEmpty()) { disposeChunk(model); return null; }
        this.ground.set(layer, bounds.min.y); model.position.y = -bounds.min.y; entry.model = model; this.roots[layer].add(model);
        return bounds.getSize(new THREE.Vector3());
      } catch (error) {
        if (!this.active || !this.isLayerEnabled(layer) || controller.signal.aborted) return null;
        throw error;
      }
    }))).filter((size): size is THREE.Vector3 => size !== null);
    return sizes.length ? sizes.reduce((combined, size) => combined.max(size), new THREE.Vector3()) : new THREE.Vector3(this.tileSize, 0, this.tileSize);
  }

  update(target: THREE.Vector3, distance: number, aspect: number) {
    if (!this.active) return;
    const cx = this.origin.x + Math.round(target.x / this.tileSize), cy = this.origin.y + Math.round(target.z / this.tileSize);
    const radius = Math.min(3, Math.max(1, Math.ceil(distance * Math.max(1, aspect) * 0.45 / this.tileSize)));
    this.desired.clear(); this.queue = [];
    for (let ring = 0; ring <= radius; ring++) for (let dx = -ring; dx <= ring; dx++) for (let dy = -ring; dy <= ring; dy++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
      const x = cx + dx, y = cy + dy, key = `${x}/${y}`;
      this.desired.add(key);
      for (const layer of ['buildings', 'trees'] as ChunkLayer[]) {
        const manifest = this.manifests.get(layer);
        if (this.isLayerEnabled(layer) && !this.entries.get(layer)!.has(key) && manifest?.[String(x)]?.includes(String(y))) this.queue.push({ layer, x, y });
      }
    }
    for (const [layer, entries] of this.entries) for (const [key, entry] of entries) if (!this.desired.has(key) || !this.isLayerEnabled(layer)) { entry.controller.abort(); if (entry.model) { this.roots[layer].remove(entry.model); disposeChunk(entry.model); } entries.delete(key); }
    this.pump();
  }

  private async fetchManifest(layer: ChunkLayer, signal: AbortSignal) {
    try {
      const response = await fetch(`${this.base}/manifest/${layer}`, { signal });
      if (response.ok) {
        this.manifests.set(layer, await response.json());
      } else if (!signal.aborted) {
        this.manifests.set(layer, {});
      }
    } catch {
      if (!signal.aborted) this.manifests.set(layer, {});
    }
  }
  private pump() { while (this.active && this.running < 3 && this.queue.length) { const { layer, x, y } = this.queue.shift()!; const key = `${x}/${y}`, controller = new AbortController(); const marker = { key, position: new THREE.Vector3((x - this.origin.x) * this.tileSize, 0, (y - this.origin.y) * this.tileSize), failed: false, layer }; const entry: Entry = { controller, marker }; this.entries.get(layer)!.set(key, entry); this.running++; void this.fetchModel(layer, x, y, controller.signal).then((model) => { if (!this.active || this.entries.get(layer)!.get(key) !== entry || !this.isLayerEnabled(layer)) { disposeChunk(model); return; } model.position.set(marker.position.x, -(this.ground.get(layer) ?? 0), marker.position.z); entry.model = model; entry.marker = undefined; this.roots[layer].add(model); }).catch((error) => { if (controller.signal.aborted) return; if (error instanceof Error && error.message === 'HTTP 404') { this.entries.get(layer)!.delete(key); const manifest = this.manifests.get(layer); const ys = manifest?.[String(x)]; if (ys) manifest[String(x)] = ys.filter((value) => value !== String(y)); return; } marker.failed = true; }).finally(() => { this.running--; if (this.active) { this.pump(); this.changed(); } }); } }
  private async fetchModel(layer: ChunkLayer, x: number, y: number, signal: AbortSignal) { const response = await fetch(`${this.base}/tiles/${layer}/16/${x}/${y}.glb`, { signal }); if (!response.ok) throw new Error(`HTTP ${response.status}`); const data = await response.arrayBuffer(); const gltf = await new Promise<GLTF>((resolve, reject) => new GLTFLoader().parse(data, `${this.base}/tiles/${layer}/16/${x}/`, resolve, reject)); gltf.scene.rotation.x = -Math.PI / 2; gltf.scene.updateMatrixWorld(true); return gltf.scene; }
  dispose() { this.active = false; this.queue = []; for (const entries of this.entries.values()) for (const entry of entries.values()) entry.controller.abort(); disposeChunk(this.root); this.entries.forEach((entries) => entries.clear()); this.root.clear(); }
}
