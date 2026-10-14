// Bienvenida y recorrido guiado: se muestran solos una vez por cuenta. Si cambian mucho, subir la versión hace que
// se vuelvan a mostrar a quien ya los vio.
export const ONBOARDING_VERSION = 1;

export type OnboardingOutcome = 'completed' | 'skipped';

// Lo que guarda el perfil (users/{uid})
export interface OnboardingRecord {
  hasSeenOnboarding?: boolean;
  onboardingVersion?: number;
  onboardingSeenAt?: string;
  onboardingOutcome?: OnboardingOutcome;
}

// Copia en este dispositivo: así no se repite sin conexión ni antes de que el perfil llegue del servidor
const localKey = (uid: string) => `clar_onboarding_v${ONBOARDING_VERSION}:${uid}`;

export const hasSeenLocally = (uid: string, storage: Storage = localStorage) => {
  try {
    return storage.getItem(localKey(uid)) !== null;
  } catch {
    return false;
  }
};

export const rememberLocally = (uid: string, outcome: OnboardingOutcome, storage: Storage = localStorage) => {
  try {
    storage.setItem(localKey(uid), outcome);
  } catch {
    // Sin almacenamiento local (p. ej. navegación privada estricta) basta con el perfil
  }
};

export const onboardingRecord = (outcome: OnboardingOutcome, now = new Date()): Required<OnboardingRecord> => ({
  hasSeenOnboarding: true,
  onboardingVersion: ONBOARDING_VERSION,
  onboardingSeenAt: now.toISOString(),
  onboardingOutcome: outcome
});

// Vista si lo dice el perfil (en esta versión o una posterior) o este dispositivo
export const hasSeenOnboarding = (profile: OnboardingRecord | null | undefined, seenLocally: boolean) =>
  seenLocally || Boolean(profile?.hasSeenOnboarding && (profile.onboardingVersion ?? 0) >= ONBOARDING_VERSION);
