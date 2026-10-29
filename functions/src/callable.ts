import {
  HttpsError,
  onCall,
  type CallableOptions,
  type CallableRequest,
  type FunctionsErrorCode
} from 'firebase-functions/https';
import * as logger from 'firebase-functions/logger';
import { adminDb } from './adminApp';
import { DEFAULT_LANGUAGE, isLanguage, languageOf, messages, type Language } from './i18n';

// FUNCIONES INVOCABLES EN EL IDIOMA DE QUIEN LLAMA: sus errores (los que ve la persona) salen en su idioma (ver i18n.ts).

// El idioma de una cuenta (su perfil, users/{uid}.language). Sin perfil o sin idioma, español; si no se puede leer,
// también: solo cambia el idioma de un texto
export const accountLanguage = async (uid: string): Promise<Language> => {
  try {
    return languageOf((await adminDb().doc(`users/${uid}`).get()).data()?.language);
  } catch (error) {
    logger.warn('Account language not read', { code: (error as { code?: string }).code ?? 'unknown' });
    return DEFAULT_LANGUAGE;
  }
};

// El idioma de quien llama: el que envía la app con la petición (`language`, opcional: así sirve también sin sesión o
// sin perfil, p. ej. una cuenta pendiente de aprobación) o, si no, el de su cuenta
export const callerLanguage = async (request: Pick<CallableRequest, 'auth' | 'data'>): Promise<Language> => {
  const sent = (request.data as { language?: unknown } | null | undefined)?.language;
  if (isLanguage(sent)) return sent;
  return request.auth ? accountLanguage(request.auth.uid) : DEFAULT_LANGUAGE;
};

// Un error para quien llama, con su texto en cada idioma. Las funciones de onUserCall lo envían en el de quien llama;
// fuera de ellas (p. ej. en las pruebas), en español
export class UserError extends HttpsError {
  constructor(
    code: FunctionsErrorCode,
    readonly text: (language: Language) => string,
    details?: unknown
  ) {
    super(code, text(DEFAULT_LANGUAGE), details);
  }

  in(language: Language) {
    return new HttpsError(this.code, this.text(language), this.details);
  }
}

// Los errores de un módulo a partir de su catálogo: `const fail = userErrors(m)` y `throw fail('not-found', (t) => t.gone)`
export const userErrors =
  <T>(catalog: Record<Language, T>) =>
  (code: FunctionsErrorCode, pick: (texts: T) => string, details?: unknown) =>
    new UserError(code, (language) => pick(catalog[language]), details);

const fail = userErrors(
  messages(
    { signIn: 'Inicia sesión para continuar.', invalid: 'Solicitud no válida.' },
    { signIn: 'Sign in to continue.', invalid: 'Invalid request.' }
  )
);

export const requireAuth = (request: CallableRequest) => {
  if (!request.auth) throw fail('unauthenticated', (t) => t.signIn);
  return request.auth;
};

export const invalidRequest = () => fail('invalid-argument', (t) => t.invalid);

// Una función invocable cuyos errores para quien llama (UserError) salen en su idioma. El perfil solo se lee al fallar,
// que es lo raro: llamar a la función no cuesta ninguna lectura más
export const onUserCall = <R>(options: CallableOptions, handler: (request: CallableRequest) => Promise<R>) =>
  onCall(options, async (request: CallableRequest) => {
    try {
      return await handler(request);
    } catch (error) {
      if (error instanceof UserError) throw error.in(await callerLanguage(request));
      throw error;
    }
  });
