// IDIOMA DE LOS TEXTOS DEL SERVIDOR: español (por defecto) o inglés, los mismos que la app (src/i18n/locale.ts). Aquí no
// hay un idioma de la página: cada texto se escribe en el de quien lo va a leer.
// - El de cada cuenta está en su perfil (users/{uid}.language, lo guarda la app; ver callable.ts).
// - El de cada dispositivo con las alarmas activadas, en su token (push_devices/{uid}/tokens/{id}.language).
// - Los avisos a la administración van siempre en español.
// Sin idioma (cuentas y dispositivos de antes de 1.2.0), español.
//
// Cómo se traduce un texto: junto a donde se usa, con `messages(es, en)`, que da los dos catálogos. El inglés tiene que
// tener lo mismo que el español (si falta algo, no compila); los textos con datos son funciones:
//
//   const m = messages({ due: (day: string) => `Vence el ${day}` }, { due: (day) => `Due ${day}` });
//   ... m[language].due(day) ...
//
// Fechas: con LANGUAGE_TAG[language], nunca 'es-ES' fijo. Lo que escribe la persona (títulos, notas…) no se traduce.
// Sin dependencias de Firebase: lo usan también las reglas puras (alarmLogic, calendarLogic…) y sus pruebas.
export type Language = 'es' | 'en';
export const LANGUAGES: readonly Language[] = ['es', 'en'];
export const DEFAULT_LANGUAGE: Language = 'es';

export const isLanguage = (value: unknown): value is Language => value === 'es' || value === 'en';
// El idioma guardado en un documento, o español si no tiene uno válido
export const languageOf = (value: unknown): Language => (isLanguage(value) ? value : DEFAULT_LANGUAGE);

// Para Intl (fechas y horas): el inglés, con el formato europeo (24 h, día antes que el mes), como la app
export const LANGUAGE_TAG: Record<Language, string> = { es: 'es-ES', en: 'en-GB' };

// Los textos en los dos idiomas. `en` tiene que tener la misma forma que `es`
export const messages = <T>(es: T, en: NoInfer<T>): Record<Language, T> => ({ es, en });
