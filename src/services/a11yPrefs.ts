// Preferencias de accesibilidad de este dispositivo. Se aplican como clases en <html> (ver index.css),
// así funcionan también antes de iniciar sesión y en las pantallas de acceso. Las celebraciones no llevan clase: la app
// mira la preferencia al celebrar (App.tsx).
export type TextSize = 'normal' | 'large' | 'xlarge';

export interface A11yPrefs {
  textSize: TextSize;
  highContrast: boolean;
  reduceMotion: boolean;
  strongFocus: boolean;
  // Mensaje y animación al hacer una tarea antigua, lograr una meta o terminar un proyecto (activas por defecto)
  celebrations: boolean;
}

export const DEFAULT_A11Y_PREFS: A11yPrefs = {
  textSize: 'normal',
  highContrast: false,
  reduceMotion: false,
  strongFocus: false,
  celebrations: true
};

export const A11Y_STORAGE_KEY = 'neuro_a11y_v1';

const TEXT_SIZES: TextSize[] = ['normal', 'large', 'xlarge'];

// Lee lo guardado descartando valores desconocidos (versiones antiguas o datos manipulados)
export const parseA11yPrefs = (raw: string | null): A11yPrefs => {
  try {
    const data = JSON.parse(raw ?? '{}') as Partial<Record<keyof A11yPrefs, unknown>>;
    return {
      textSize: TEXT_SIZES.includes(data.textSize as TextSize)
        ? (data.textSize as TextSize)
        : DEFAULT_A11Y_PREFS.textSize,
      highContrast: data.highContrast === true,
      reduceMotion: data.reduceMotion === true,
      strongFocus: data.strongFocus === true,
      celebrations: data.celebrations !== false
    };
  } catch {
    return DEFAULT_A11Y_PREFS;
  }
};

export const A11Y_CLASSES = [
  'a11y-text-large',
  'a11y-text-xlarge',
  'a11y-contrast',
  'a11y-reduce-motion',
  'a11y-focus'
] as const;

export const classesFor = (prefs: A11yPrefs): string[] =>
  [
    prefs.textSize === 'large' && 'a11y-text-large',
    prefs.textSize === 'xlarge' && 'a11y-text-xlarge',
    prefs.highContrast && 'a11y-contrast',
    prefs.reduceMotion && 'a11y-reduce-motion',
    prefs.strongFocus && 'a11y-focus'
  ].filter((c): c is string => Boolean(c));

export const applyA11yPrefs = (prefs: A11yPrefs, root: HTMLElement = document.documentElement) => {
  root.classList.remove(...A11Y_CLASSES);
  root.classList.add(...classesFor(prefs));
};

export const loadA11yPrefs = (): A11yPrefs => {
  try {
    return parseA11yPrefs(localStorage.getItem(A11Y_STORAGE_KEY));
  } catch {
    return DEFAULT_A11Y_PREFS;
  }
};

export const saveA11yPrefs = (prefs: A11yPrefs) => {
  try {
    localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Sin almacenamiento (modo privado estricto) las preferencias duran hasta cerrar la pestaña
  }
  applyA11yPrefs(prefs);
};
