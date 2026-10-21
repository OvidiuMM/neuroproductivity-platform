import { FirebaseError } from 'firebase/app';
import { doc, onSnapshot, type Firestore } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type { FirebaseServices } from './firebase';

// SINCRONIZACIÓN CON GOOGLE CALENDAR (función extra): la conexión desde la app. Al conectar se abre la autorización de
// Google en una ventana (con PKCE); Google vuelve a /oauth/google.html (public/oauth/google.js), que pasa el código a
// esta ventana, y la Cloud Function connectGoogleCalendar lo canjea, crea el calendario «CLAR» y sube las tareas
// (functions/src/calendarSync.ts). La app solo lee el estado de la conexión (calendar_status/{uid}).
// Sin el id del cliente OAuth en la compilación (VITE_GOOGLE_OAUTH_CLIENT_ID), no se ofrece.
// (Fuera de Vite, p. ej. en las pruebas unitarias, no hay `import.meta.env`). Sin espacios: con ellos Google no
// reconoce el cliente («invalid_client»)
const CLIENT_ID = (import.meta.env as ImportMetaEnv | undefined)?.VITE_GOOGLE_OAUTH_CLIENT_ID?.trim();
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';
export const OAUTH_CALLBACK_PATH = '/oauth/google.html';
const CHANNEL = 'clar-google-oauth';
// Lo que se espera a que la persona termine en Google
const AUTHORIZATION_TIMEOUT_MS = 5 * 60_000;
// Subir todas las tareas puede tardar: la función tiene hasta 9 minutos, y se le da algo más
const CONNECT_TIMEOUT_MS = 10 * 60_000;

export const calendarSyncAvailable = () => Boolean(CLIENT_ID);

export type CalendarState = 'syncing' | 'connected' | 'needsReconnect' | 'disconnected';
export type ReconnectReason = 'revoked' | 'calendarMissing';
export interface CalendarStatus {
  state: CalendarState;
  reason?: ReconnectReason;
  connectedAt?: string;
  syncedAt?: string;
  updatedAt?: string;
  failed?: number;
}

const STATES: CalendarState[] = ['syncing', 'connected', 'needsReconnect', 'disconnected'];
const REASONS: ReconnectReason[] = ['revoked', 'calendarMissing'];

// El estado de la conexión de la cuenta; sin documento (o sin poder leerlo), desconectada
export const subscribeToCalendarStatus = (db: Firestore, uid: string, onChange: (status: CalendarStatus) => void) =>
  onSnapshot(
    doc(db, 'calendar_status', uid),
    (snapshot) => {
      const data = snapshot.data() as Partial<CalendarStatus> | undefined;
      if (!data?.state || !STATES.includes(data.state)) return onChange({ state: 'disconnected' });
      onChange({
        state: data.state,
        ...(data.reason && REASONS.includes(data.reason) ? { reason: data.reason } : {}),
        ...(typeof data.connectedAt === 'string' ? { connectedAt: data.connectedAt } : {}),
        ...(typeof data.syncedAt === 'string' ? { syncedAt: data.syncedAt } : {}),
        ...(typeof data.updatedAt === 'string' ? { updatedAt: data.updatedAt } : {}),
        ...(typeof data.failed === 'number' ? { failed: data.failed } : {})
      });
    },
    (e) => {
      console.error('Error loading the Google Calendar connection:', e);
      onChange({ state: 'disconnected' });
    }
  );

const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const randomString = (bytes: number) => base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
const challengeOf = async (verifier: string) =>
  base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));

// Dirección de la autorización: solo el permiso del calendario propio, sin conexión (para sincronizar con CLAR
// cerrada) y pidiendo siempre el consentimiento, así Google devuelve el permiso también al volver a conectar
export const authorizationUrl = ({
  clientId,
  redirectUri,
  state,
  challenge
}: {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
}) =>
  `${AUTH_URL}?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: CALENDAR_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'false',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  }).toString()}`;

interface OAuthMessage {
  type?: unknown;
  state?: unknown;
  code?: unknown;
  error?: unknown;
}

// Espera la vuelta de Google con este `state` (cualquier otro mensaje se ignora)
const waitForCode = (state: string, signal?: AbortSignal) =>
  new Promise<string>((resolve, reject) => {
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);
    const finish = () => {
      channel?.close();
      window.removeEventListener('message', onWindowMessage);
      signal?.removeEventListener('abort', onAbort);
      window.clearTimeout(timer);
    };
    const onMessage = (data: OAuthMessage) => {
      if (data?.type !== CHANNEL || data.state !== state) return;
      finish();
      if (typeof data.code === 'string' && data.code) resolve(data.code);
      else
        reject(
          new Error(
            data.error === 'access_denied'
              ? 'No se dio permiso en Google: el calendario no se ha conectado.'
              : 'Google no completó la autorización. Inténtalo de nuevo.'
          )
        );
    };
    const onWindowMessage = (e: MessageEvent<OAuthMessage>) => {
      if (e.origin === window.location.origin) onMessage(e.data);
    };
    const onAbort = () => {
      finish();
      reject(new Error('Conexión cancelada.'));
    };
    const timer = window.setTimeout(() => {
      finish();
      reject(new Error('Se acabó el tiempo para dar permiso en Google. Inténtalo de nuevo.'));
    }, AUTHORIZATION_TIMEOUT_MS);
    channel?.addEventListener('message', (e: MessageEvent<OAuthMessage>) => onMessage(e.data));
    window.addEventListener('message', onWindowMessage);
    signal?.addEventListener('abort', onAbort);
  });

// Conecta la cuenta. Se llama al pulsar el botón: la ventana se abre al momento (si no, el navegador la bloquea) y se
// le pone la dirección de Google cuando está lista. `onAuthorized` avisa de que Google ya respondió y empieza la subida
// de las tareas (que ya no se puede cancelar desde aquí)
export const connectGoogleCalendar = async (
  { functions }: FirebaseServices,
  { signal, onAuthorized }: { signal?: AbortSignal; onAuthorized?: () => void } = {}
) => {
  if (!CLIENT_ID) throw new Error('La sincronización con Google Calendar no está disponible en esta instalación.');
  const popup = window.open('', 'clar-google-calendar', 'popup,width=520,height=680');
  if (!popup) throw new Error('El navegador bloqueó la ventana de Google. Permite las ventanas emergentes de CLAR.');
  const state = randomString(24);
  const verifier = randomString(48);
  const redirectUri = `${window.location.origin}${OAUTH_CALLBACK_PATH}`;
  let code: string;
  try {
    popup.location.href = authorizationUrl({
      clientId: CLIENT_ID,
      redirectUri,
      state,
      challenge: await challengeOf(verifier)
    });
    code = await waitForCode(state, signal);
  } catch (e) {
    // Al cancelar o acabarse el tiempo, la ventana de Google se cierra (si aún se puede)
    try {
      popup.close();
    } catch {
      // Ya no es accesible
    }
    throw e;
  }
  onAuthorized?.();
  return (
    await httpsCallable<
      { code: string; codeVerifier: string; redirectUri: string; timeZone: string },
      { synced: number; failed: number }
    >(functions, 'connectGoogleCalendar', { timeout: CONNECT_TIMEOUT_MS })({
      code,
      codeVerifier: verifier,
      redirectUri,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    })
  ).data;
};

// Un fallo de conexión con el servidor, en español. Los mensajes del servidor ya vienen en español y se muestran tal
// cual (sin el código de estado que añade el SDK); solo se sustituye el mensaje genérico del SDK, que es el propio código
const CALL_ERRORS: Record<string, string> = {
  internal: 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  unavailable: 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  unknown: 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  'deadline-exceeded':
    'La subida de las tareas está tardando más de lo normal y sigue en marcha. Vuelve a mirar en unos minutos.'
};
export const calendarErrorMessage = (e: unknown, fallback: string) => {
  if (!(e instanceof Error)) return fallback;
  const message = e.message.replace(/\s*\[\d+\]$/, '').trim();
  if (e instanceof FirebaseError && e.code.startsWith('functions/')) {
    const code = e.code.slice('functions/'.length);
    if (!message || message.toLowerCase() === code) return CALL_ERRORS[code] ?? fallback;
  }
  return message || fallback;
};

export const disconnectGoogleCalendar = async ({ functions }: FirebaseServices) => {
  await httpsCallable(functions, 'disconnectGoogleCalendar')();
};
