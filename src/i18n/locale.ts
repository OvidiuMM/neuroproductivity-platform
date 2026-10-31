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
// Un enlace con ?lang=en (o ?lang=es) abre CLAR en ese idioma y lo deja guardado en el dispositivo. No cambia el idioma
// de una cuenta que ya tiene uno (en esa visita se ve el del enlace; la siguiente, el de la cuenta); una cuenta sin
// idioma, o nueva, se queda con el del enlace. El parámetro se quita de la dirección (consumeLocaleParam)
const LANG_PARAM = 'lang';
const fromUrl = (): Locale | null => {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get(LANG_PARAM);
  return isLocale(value) ? value : null;
};
const initial = (): Locale => {
  const forced = (globalThis as { __CLAR_LOCALE__?: unknown }).__CLAR_LOCALE__;
  if (isLocale(forced)) return forced;
  const linked = fromUrl();
  if (linked) {
    try {
      localStorage.setItem(STORAGE_KEY, linked);
    } catch {
      // Sin almacenamiento: vale para esta carga
    }
    return linked;
  }
  const saved = typeof window === 'undefined' ? null : read(STORAGE_KEY);
  return isLocale(saved) ? saved : 'es';
};
export const LOCALE: Locale = initial();
// Esta carga viene de un enlace con ?lang=: el idioma de la cuenta no la vuelve a cargar (useAccountLanguage)
export const LINKED = fromUrl() !== null;
const RELOADED_KEY = 'clar_locale_reloaded';
// La recarga para adoptar el idioma de la cuenta funcionó: se olvida (ver setLocale)
if (typeof window !== 'undefined') {
  try {
    if (sessionStorage.getItem(RELOADED_KEY) === LOCALE) sessionStorage.removeItem(RELOADED_KEY);
  } catch {
    // Sin sessionStorage
  }
}
// Para Intl (fechas, números, orden alfabético): el inglés, con el formato europeo (24 h, día antes que el mes)
export const LOCALE_TAG = LOCALE === 'en' ? 'en-GB' : 'es-ES';

// Los textos del idioma de esta carga. `en` tiene que tener la misma forma que `es`
export const messages = <T>(es: T, en: NoInfer<T>): T => (LOCALE === 'en' ? en : es);

export const hasPendingLocale = () => read(PENDING_KEY) === '1';
// El guardado en este dispositivo ahora (otra pestaña puede haberlo cambiado después de cargar esta)
export const storedLocale = (): Locale | null => {
  const saved = read(STORAGE_KEY);
  return isLocale(saved) ? saved : null;
};
export const clearPendingLocale = () => {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // Sin almacenamiento: se volverá a guardar en la cuenta en la próxima carga
  }
};

// Cambia el idioma y vuelve a cargar la app. `pending`: lo eligió la persona en este dispositivo (se guardará en su
// cuenta al entrar); sin él, viene de la cuenta. `reload: false`: se aplica la próxima vez que se abra. Si el
// dispositivo no deja guardarlo, no se recarga (se quedaría igual) y devuelve false. Elegir el que ya se ve no cambia
// nada (tampoco pasa a la cuenta, aunque en este dispositivo aún no se hubiera elegido ninguno). Contra bucles, al adoptar el de la cuenta: si una recarga por ese idioma no sirvió
// (la página volvió a cargar en otro), no se repite. Cuando sí sirvió, al cargar se olvida.
export const setLocale = (
  next: Locale,
  { pending = true, reload = true }: { pending?: boolean; reload?: boolean } = {}
) => {
  // El que ya se ve: no es un cambio (tampoco una elección que deba pasar a la cuenta)
  if (next === LOCALE) {
    try {
      if (storedLocale() !== next) localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Sin almacenamiento: no hace falta
    }
    return true;
  }
  try {
    localStorage.setItem(STORAGE_KEY, next);
    if (pending) localStorage.setItem(PENDING_KEY, '1');
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    return false;
  }
  if (read(STORAGE_KEY) !== next) return false;
  if (next === LOCALE || !reload) return true;
  if (!pending) {
    try {
      if (sessionStorage.getItem(RELOADED_KEY) === next) return true;
      sessionStorage.setItem(RELOADED_KEY, next);
    } catch {
      // Sin sessionStorage no hay forma de saberlo: se recarga
    }
  }
  window.location.reload();
  return true;
};

// Qué hacer con el idioma de la cuenta al abrir la app (useAccountLanguage), una vez, con el perfil del servidor:
// - elegido en este dispositivo y sin guardar en la cuenta (o la cuenta sin idioma): se guarda el del dispositivo,
//   el de ahora (otra pestaña pudo cambiarlo después de cargar esta);
// - si no, manda el de la cuenta. Si es otro, se recarga solo si el perfil llegó al poco de abrir (después, la
//   persona ya está usando la app: se aplica la próxima vez)
export const ADOPT_WINDOW_MS = 5_000;
export type LanguageSync =
  { action: 'save'; language: Locale } | { action: 'adopt'; language: Locale; reload: boolean } | { action: 'none' };
export const accountLanguageSync = ({
  pending,
  stored,
  account,
  page,
  sinceOpenMs
}: {
  pending: boolean;
  stored: Locale | null;
  account: unknown;
  page: Locale;
  sinceOpenMs: number;
}): LanguageSync => {
  if (pending || !isLocale(account)) return { action: 'save', language: stored ?? page };
  if (account === page) return { action: 'none' };
  return { action: 'adopt', language: account, reload: sinceOpenMs <= ADOPT_WINDOW_MS };
};

// Quita ?lang= de la dirección (ya se aplicó al cargar): así recargar o compartir la página no lo repite
export const consumeLocaleParam = () => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(LANG_PARAM)) return;
  url.searchParams.delete(LANG_PARAM);
  window.history.replaceState(window.history.state, '', url);
};

// <html lang> según el idioma (lectores de pantalla, traductores, corrección ortográfica)
export const applyDocumentLocale = () => {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = LOCALE;
  document.title = messages<string>(
    'CLAR · Decide qué hacer ahora, con claridad',
    'CLAR · Decide what to do now, with clarity'
  );
};
