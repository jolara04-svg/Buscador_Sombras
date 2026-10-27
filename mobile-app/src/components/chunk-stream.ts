import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

const TILE_COUNT = 2 ** 16;
export type ChunkMarker = { key: string; position: THREE.Vector3; failed: boolean };

export function disposeChunk(model: THREE.Object3D) {
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material: THREE.Material) => material.dispose());
  });
}

// Dataset coordinates are local ENU around each Slippy tile's centre, in metres.
export class ChunkStream {
  readonly root = new THREE.Group();
  readonly origin: { x: number; y: number };
  readonly tileSize: number;
  private base: string;
  private entries = new Map<string, { model?: THREE.Object3D; marker?: ChunkMarker; controller: AbortController }>();
  private manifest: Record<string, string[]> | null = null;
  private active = true;
  private desired = new Set<string>();
  private queue: { x: number; y: number }[] = [];
  private running = 0;
  private ground = 0;

  constructor(url: string, private changed: () => void) {
    const parsed = new URL(url);
    const lat = Number(parsed.searchParams.get('lat'));
    const lon = Number(parsed.searchParams.get('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('Ubicación 3D inválida.');
    const rad = lat * Math.PI / 180;
    this.origin = {
      x: Math.floor((lon + 180) / 360 * TILE_COUNT),
      y: Math.floor((1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2 * TILE_COUNT),
    };
    const centreLat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (this.origin.y + 0.5) / TILE_COUNT)));
    this.tileSize = 2 * Math.PI * 6378137 * Math.cos(centreLat) / TILE_COUNT;
    this.base = parsed.origin;
  }

  get markers() {
    return [...this.entries.values()].flatMap((entry) => entry.marker ? [entry.marker] : []);
  }

  async initialize() {
    const controller = new AbortController();
    const key = `${this.origin.x}/${this.origin.y}`;
    this.entries.set(key, { controller });
    const model = await this.fetchModel(this.origin.x, this.origin.y, controller.signal);
    if (!this.active) { disposeChunk(model); return null; }
    const bounds = new THREE.Box3().setFromObject(model);
    if (bounds.isEmpty()) { disposeChunk(model); throw new Error('El chunk no contiene geometría visible.'); }
    this.ground = bounds.min.y;
    model.position.y = -this.ground;
    this.entries.set(key, { model, controller });
    this.root.add(model);
    // Coverage is optional: HTTP 404 still identifies missing tiles if it is unavailable.
    void fetch(`${this.base}/manifest`, { signal: controller.signal }).then(async (response) => {
      if (response.ok && this.active) this.manifest = await response.json();
    }).catch(() => {});
    return bounds.getSize(new THREE.Vector3());
  }

  update(target: THREE.Vector3, distance: number, aspect: number) {
    if (!this.active) return;
    const cx = this.origin.x + Math.round(target.x / this.tileSize);
    const cy = this.origin.y + Math.round(target.z / this.tileSize);
    const radius = Math.min(3, Math.max(1, Math.ceil(distance * Math.max(1, aspect) * 0.45 / this.tileSize)));
    this.desired.clear();
    this.queue = [];
    for (let ring = 0; ring <= radius; ring++) {
      for (let dx = -ring; dx <= ring; dx++) for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const x = cx + dx, y = cy + dy, key = `${x}/${y}`;
        if (this.manifest && !this.manifest[String(x)]?.includes(String(y))) continue;
        this.desired.add(key);
        if (!this.entries.has(key)) this.queue.push({ x, y });
      }
    }
    for (const [key, entry] of this.entries) {
      if (this.desired.has(key)) continue;
      entry.controller.abort();
      if (entry.model) { this.root.remove(entry.model); disposeChunk(entry.model); }
      this.entries.delete(key);
    }
    this.pump();
  }

  private pump() {
    while (this.active && this.running < 3 && this.queue.length) {
      const { x, y } = this.queue.shift()!;
      const key = `${x}/${y}`;
      const controller = new AbortController();
      const marker: ChunkMarker = { key, position: new THREE.Vector3((x - this.origin.x) * this.tileSize, 0, (y - this.origin.y) * this.tileSize), failed: false };
      const entry = { controller, marker } as { controller: AbortController; marker?: ChunkMarker; model?: THREE.Object3D };
      this.entries.set(key, entry);
      this.running++;
      void this.fetchModel(x, y, controller.signal).then((model) => {
        if (!this.active || this.entries.get(key) !== entry) { disposeChunk(model); return; }
        model.position.set(marker.position.x, -this.ground, marker.position.z);
        entry.model = model;
        entry.marker = undefined;
        this.root.add(model);
      }).catch((error: unknown) => {
        if (controller.signal.aborted) return;
        marker.failed = true;
        if (error instanceof Error && error.message === 'HTTP 404') entry.marker = undefined;
      }).finally(() => {
        this.running--;
        if (this.active) { this.pump(); this.changed(); }
      });
    }
  }

  private async fetchModel(x: number, y: number, signal: AbortSignal) {
    const url = `${this.base}/tiles/16/${x}/${y}.glb`;
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.arrayBuffer();
    const gltf = await new Promise<GLTF>((resolve, reject) => new GLTFLoader().parse(data, `${this.base}/tiles/16/${x}/`, resolve, reject));
    gltf.scene.rotation.x = -Math.PI / 2;
    gltf.scene.updateMatrixWorld(true);
    return gltf.scene;
  }

  dispose() {
    this.active = false;
    this.queue = [];
    for (const entry of this.entries.values()) entry.controller.abort();
    disposeChunk(this.root);
    this.entries.clear();
    this.root.clear();
  }
}
