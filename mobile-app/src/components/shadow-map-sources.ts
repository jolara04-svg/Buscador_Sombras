import type { BufferGeometry } from 'three';

export type ShadowSource = 'buildings' | 'vegetation';
export type ShadowSourceSelection = Partial<Record<ShadowSource, boolean | string>>;

export const SHADOW_SOURCE_WEIGHTS: Record<ShadowSource, number> = {
  buildings: 1,
  vegetation: 0.75,
};

export function sourceEnabled(selection: ShadowSourceSelection | undefined, source: ShadowSource) {
  const value = selection?.[source];
  return value !== false;
}

export function sourceUrl(baseUrl: string, source: ShadowSource, selection?: ShadowSourceSelection) {
  const configured = selection?.[source];
  if (typeof configured === 'string' && configured.length > 0) return configured;
  if (source === 'buildings') return baseUrl;

  // Keep the existing chunk URL as the building source. Vegetation datasets use
  // the sibling `-vegetation.glb` convention, while callers may provide an
  // explicit URL through `sources.vegetation` when their backend differs.
  if (/\.glb(?:$|\?)/i.test(baseUrl)) {
    return baseUrl.replace(/\.glb(?=($|\?))/i, '-vegetation.glb');
  }
  return `${baseUrl.replace(/\/$/, '')}/vegetation.glb`;
}

export type LoadedShadowSource = {
  source: ShadowSource;
  geometries: BufferGeometry[];
};
