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

// Un uid que sirve como id de documento de Firestore (los de Firebase Auth tienen hasta 128 caracteres)
export const isDocumentId = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 128 &&
  !value.includes('/') &&
  value !== '.' &&
  value !== '..' &&
  !/^__.*__$/.test(value);

// La petición de setFeatures: la cuenta y sus funciones, o null si no vale
export const parseFeatureRequest = (data: unknown): { uid: string; granted: FeatureId[] } | null => {
  const { uid, features } = (data ?? {}) as { uid?: unknown; features?: unknown };
  const granted = parseFeatureList(features);
  return isDocumentId(uid) && granted ? { uid, granted } : null;
};
