import type { ShadowLayer, ShadowLayerSelection, ShadowLayerWeights } from './shadow-settings';

export type ShadowSource = ShadowLayer;
export type ShadowSourceSelection = ShadowLayerSelection;

export const SHADOW_SOURCE_WEIGHTS: ShadowLayerWeights = {
  buildings: 1,
  trees: 0.75,
};

export function sourceEnabled(selection: ShadowSourceSelection | undefined, source: ShadowSource) {
  return selection?.[source] !== false;
}

// Convierte la URL compatible existente /chunk?lat=...&lon=... en una URL para
// la capa pedida. Los endpoints directos de teselas se mantienen igualmente.
export function sourceUrl(baseUrl: string, source: ShadowSource, selection?: ShadowSourceSelection) {
  if (selection?.[source] === false) return null;
  const url = new URL(baseUrl);
  if (url.pathname.endsWith('/chunk')) {
    url.searchParams.set('layer', source);
    return url.toString();
  }

  const directTile = url.pathname.match(/^(.*\/tiles\/)(?:(buildings|trees)\/)?(\d+)\/(\d+)\/(\d+)\.glb$/);
  if (directTile) {
    url.pathname = `${directTile[1]}${source}/${directTile[3]}/${directTile[4]}/${directTile[5]}.glb`;
    return url.toString();
  }

  return `${url.origin}/tiles/${source}/16/${url.searchParams.get('x') || ''}/${url.searchParams.get('y') || ''}.glb`;
}

export function sourceOpacity(source: ShadowSource, weights?: Partial<ShadowLayerWeights>) {
  const weight = weights?.[source] ?? SHADOW_SOURCE_WEIGHTS[source];
  return Number.isFinite(weight) ? Math.max(0, Math.min(1, weight)) : SHADOW_SOURCE_WEIGHTS[source];
}
