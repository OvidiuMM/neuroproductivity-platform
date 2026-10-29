// IDIOMA DE LA APP: español (por defecto) o inglés. Se elige en la página de inicio o en el menú de la cuenta y se
// guarda en el dispositivo y en la cuenta (users/{uid}.language, ver useAccountLanguage). Al cambiarlo, la app se
// vuelve a cargar: así el idioma es fijo mientras la página está abierta y los textos y formatos se pueden elegir al
// cargar cada módulo (también los de fuera de React, como describeRecurrence).
//
// Cómo se traduce un texto: junto a donde se usa, con `messages(es, en)`. El catálogo inglés tiene que tener lo mismo
// que el español (si falta algo, no compila); los textos con datos son funciones:
//
//   const m = messages({ title: 'Nueva tarea', count: (n: number) => `${n} tareas` }, { title: 'New task', count: (n) => `${n} tasks` });
//   ... <h2>{m.title}</h2> ...
//
// Fechas y números: con LOCALE_TAG (p. ej. new Intl.DateTimeFormat(LOCALE_TAG, …)), nunca 'es-ES' fijo. Lo que escribe
// la persona (títulos, notas…) no se traduce nunca.
export type Locale = 'es' | 'en';
export const LOCALES: readonly Locale[] = ['es', 'en'];
export const LOCALE_NAMES: Record<Locale, string> = { es: 'Español', en: 'English' };

const STORAGE_KEY = 'clar_locale';
// Elegido en este dispositivo y aún sin guardar en la cuenta (p. ej. antes de entrar, o sin conexión)
const PENDING_KEY = 'clar_locale_pending';

export const isLocale = (value: unknown): value is Locale => value === 'es' || value === 'en';

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

// El idioma de esta carga de la página. En los entornos sin navegador (pruebas, servidor), español; las pruebas
// pueden fijar otro con globalThis.__CLAR_LOCALE__
const initial = (): Locale => {
  const forced = (globalThis as { __CLAR_LOCALE__?: unknown }).__CLAR_LOCALE__;
  if (isLocale(forced)) return forced;
  const saved = typeof window === 'undefined' ? null : read(STORAGE_KEY);
  return isLocale(saved) ? saved : 'es';
};
export const LOCALE: Locale = initial();
// Para Intl (fechas, números, orden alfabético): el inglés, con el formato europeo (24 h, día antes que el mes)
export const LOCALE_TAG = LOCALE === 'en' ? 'en-GB' : 'es-ES';

// Los textos del idioma de esta carga. `en` tiene que tener la misma forma que `es`
export const messages = <T>(es: T, en: NoInfer<T>): T => (LOCALE === 'en' ? en : es);

export const hasPendingLocale = () => read(PENDING_KEY) === '1';
export const clearPendingLocale = () => {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // Sin almacenamiento: se volverá a guardar en la cuenta en la próxima carga
  }
};

// Cambia el idioma y vuelve a cargar la app. `pending`: lo eligió la persona en este dispositivo (se guardará en su
// cuenta al entrar); sin él, viene de la cuenta. Si el dispositivo no deja guardarlo, no se recarga (se quedaría igual)
export const setLocale = (next: Locale, { pending = true }: { pending?: boolean } = {}) => {
  try {
    localStorage.setItem(STORAGE_KEY, next);
    if (pending) localStorage.setItem(PENDING_KEY, '1');
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    return false;
  }
  if (read(STORAGE_KEY) !== next) return false;
  if (next !== LOCALE) window.location.reload();
  return true;
};

// <html lang> según el idioma (lectores de pantalla, traductores, corrección ortográfica)
export const applyDocumentLocale = () => {
  if (typeof document !== 'undefined') document.documentElement.lang = LOCALE;
};
