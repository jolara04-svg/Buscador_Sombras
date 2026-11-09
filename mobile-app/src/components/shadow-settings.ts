import { useCallback, useEffect, useState } from 'react';

export type ShadowLayer = 'buildings' | 'trees';

export type ShadowLayerSelection = Record<ShadowLayer, boolean>;
export type ShadowLayerWeights = Record<ShadowLayer, number>;

export const DEFAULT_SHADOW_LAYER_SELECTION: ShadowLayerSelection = {
  buildings: true,
  trees: true,
};

export const DEFAULT_SHADOW_LAYER_WEIGHTS: ShadowLayerWeights = {
  buildings: 1,
  trees: 0.75,
};

const STORAGE_KEY = 'sombrapp.shadow-layer-weights.v1';

function finitePositive(value: unknown, fallback: number) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

export function normalizeShadowLayerWeights(value: unknown): ShadowLayerWeights {
  const candidate = value && typeof value === 'object' ? value as Partial<ShadowLayerWeights> : {};
  return {
    buildings: finitePositive(candidate.buildings, DEFAULT_SHADOW_LAYER_WEIGHTS.buildings),
    trees: finitePositive(candidate.trees, DEFAULT_SHADOW_LAYER_WEIGHTS.trees),
  };
}

export function loadShadowLayerWeights(): ShadowLayerWeights {
  if (typeof localStorage === 'undefined') return DEFAULT_SHADOW_LAYER_WEIGHTS;
  try {
    return normalizeShadowLayerWeights(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
  } catch {
    return DEFAULT_SHADOW_LAYER_WEIGHTS;
  }
}

export function saveShadowLayerWeights(value: ShadowLayerWeights) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeShadowLayerWeights(value)));
  } catch {
    // La app sigue funcionando aunque el navegador no permita almacenamiento.
  }
}

export function useShadowLayerWeights() {
  const [weights, setWeightsState] = useState<ShadowLayerWeights>(loadShadowLayerWeights);

  useEffect(() => {
    saveShadowLayerWeights(weights);
  }, [weights]);

  const setWeights = useCallback((value: ShadowLayerWeights | ((current: ShadowLayerWeights) => ShadowLayerWeights)) => {
    setWeightsState(current => normalizeShadowLayerWeights(typeof value === 'function' ? value(current) : value));
  }, []);

  const setWeight = useCallback((layer: ShadowLayer, value: number | string) => {
    setWeights(current => ({ ...current, [layer]: finitePositive(value, current[layer]) }));
  }, [setWeights]);

  return { weights, setWeights, setWeight };
}
