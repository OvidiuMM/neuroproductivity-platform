import { collection, doc, onSnapshot, setDoc, type Firestore } from 'firebase/firestore';
import { httpsCallable, type Functions } from 'firebase/functions';
import { LOCALE, messages, type Locale } from '../i18n/locale';

// FUNCIONES EXTRA: lo que la administración activa a cada cuenta desde Administración → Solicitudes. Se guardan en
// features/{uid}, que solo escribe el servidor (functions/src/features.ts) y leen la propia cuenta y la
// administración. La administración las tiene todas y las enciende o apaga en su cuenta (users/{uid}.featurePrefs);
// para el resto, una función concedida está en uso desde ese momento.
// El servidor tiene la misma lista de ids en functions/src/featuresLogic.ts.
export type FeatureId = 'googleCalendar';

export interface ExtraFeature {
  id: FeatureId;
  label: string;
  description: string;
}

const m = messages(
  {
    googleCalendar: {
      label: 'Sincronizar con Google Calendar',
      description:
        'Las tareas con fecha aparecen en un calendario «CLAR» de tu cuenta de Google y se actualizan al cambiarlas.'
    }
  },
  {
    googleCalendar: {
      label: 'Sync with Google Calendar',
      description:
        'Tasks with a date appear in a “CLAR” calendar in your Google account and update when you change them.'
    }
  }
);

export const EXTRA_FEATURES: readonly ExtraFeature[] = [{ id: 'googleCalendar', ...m.googleCalendar }];

const FEATURE_IDS = EXTRA_FEATURES.map((f) => f.id);

// Lo guardado en Firestore, sin fiarse: solo las del catálogo, en su orden
export const featureList = (value: unknown): FeatureId[] =>
  Array.isArray(value) ? FEATURE_IDS.filter((id) => value.includes(id)) : [];

export type FeaturePrefs = Partial<Record<FeatureId, boolean>>;

export const featurePrefsOf = (value: unknown): FeaturePrefs => {
  if (!value || typeof value !== 'object') return {};
  const prefs: FeaturePrefs = {};
  for (const id of FEATURE_IDS) {
    const on = (value as Record<string, unknown>)[id];
    if (typeof on === 'boolean') prefs[id] = on;
  }
  return prefs;
};

// Las que están en uso: para la administración, las que tiene encendidas (empiezan apagadas); para el resto, las que
// tiene concedidas
export const activeFeatures = ({
  isAdmin,
  granted,
  prefs
}: {
  isAdmin: boolean;
  granted: FeatureId[];
  prefs: FeaturePrefs;
}): FeatureId[] => (isAdmin ? FEATURE_IDS.filter((id) => prefs[id] === true) : granted);

// Las de la propia cuenta. Sin documento (o sin poder leerlo), ninguna
export const subscribeToOwnFeatures = (db: Firestore, uid: string, onChange: (granted: FeatureId[]) => void) =>
  onSnapshot(
    doc(db, 'features', uid),
    (snapshot) => onChange(featureList(snapshot.data()?.granted)),
    (e) => {
      console.error('Error loading own extra features:', e);
      onChange([]);
    }
  );

// Solo para la administración: las de todas las cuentas, por uid
export const subscribeToAllFeatures = (
  db: Firestore,
  onChange: (features: Record<string, FeatureId[]>) => void,
  onError: (error: Error) => void
) =>
  onSnapshot(
    collection(db, 'features'),
    (snapshot) =>
      onChange(Object.fromEntries(snapshot.docs.map((d) => [d.id, featureList(d.data().granted)] as const))),
    onError
  );

export const setFeatures = async (functions: Functions, uid: string, features: FeatureId[]) =>
  (
    await httpsCallable<{ uid: string; features: FeatureId[]; language: Locale }, { features: FeatureId[] }>(
      functions,
      'setFeatures'
    )({ uid, features, language: LOCALE })
  ).data;

// La administración enciende o apaga una función en su cuenta
export const saveFeaturePref = (db: Firestore, uid: string, id: FeatureId, on: boolean) =>
  setDoc(doc(db, 'users', uid), { featurePrefs: { [id]: on } }, { merge: true });
