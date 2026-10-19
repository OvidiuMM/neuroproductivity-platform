// FUNCIONES EXTRA: el catálogo de lo que la administración puede activar a cada cuenta. La app tiene la misma lista,
// con sus nombres y descripciones, en src/services/features.ts (tests/unit/features.test.ts comprueba que coinciden).
export const FEATURE_IDS = ['googleCalendar'] as const;
export type FeatureId = (typeof FEATURE_IDS)[number];

export const isFeatureId = (value: unknown): value is FeatureId =>
  typeof value === 'string' && (FEATURE_IDS as readonly string[]).includes(value);

// Lo que pide la administración: funciones del catálogo, sin repetir. Se guardan en el orden del catálogo. Cualquier
// otra cosa no vale (null).
export const parseFeatureList = (value: unknown): FeatureId[] | null => {
  if (!Array.isArray(value) || !value.every(isFeatureId)) return null;
  if (new Set(value).size !== value.length) return null;
  return FEATURE_IDS.filter((id) => value.includes(id));
};
