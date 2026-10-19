import { doc, onSnapshot, type Firestore } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type { FirebaseServices } from './firebase';

// SINCRONIZACIÓN CON GOOGLE CALENDAR (función extra): la conexión desde la app. Al conectar se abre la autorización de
// Google en una ventana (con PKCE); Google vuelve a /oauth/google.html (public/oauth/google.js), que pasa el código a
// esta ventana, y la Cloud Function connectGoogleCalendar lo canjea, crea el calendario «CLAR» y sube las tareas
// (functions/src/calendarSync.ts). La app solo lee el estado de la conexión (calendar_status/{uid}).
// Sin el id del cliente OAuth en la compilación (VITE_GOOGLE_OAUTH_CLIENT_ID), no se ofrece.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';
export const OAUTH_CALLBACK_PATH = '/oauth/google.html';
const CHANNEL = 'clar-google-oauth';
// Lo que se espera a que la persona termine en Google
const AUTHORIZATION_TIMEOUT_MS = 5 * 60_000;
// Subir todas las tareas puede tardar (la función tiene hasta 9 minutos)
const CONNECT_TIMEOUT_MS = 9 * 60_000;

export const calendarSyncAvailable = () => Boolean(CLIENT_ID);

export type CalendarState = 'syncing' | 'connected' | 'needsReconnect' | 'disconnected';
export interface CalendarStatus {
  state: CalendarState;
  reason?: 'revoked' | 'calendarMissing';
  connectedAt?: string;
  syncedAt?: string;
  failed?: number;
}

const STATES: CalendarState[] = ['syncing', 'connected', 'needsReconnect', 'disconnected'];

// El estado de la conexión de la cuenta; sin documento (o sin poder leerlo), desconectada
export const subscribeToCalendarStatus = (db: Firestore, uid: string, onChange: (status: CalendarStatus) => void) =>
  onSnapshot(
    doc(db, 'calendar_status', uid),
    (snapshot) => {
      const data = snapshot.data() as Partial<CalendarStatus> | undefined;
      onChange(data?.state && STATES.includes(data.state) ? { ...data, state: data.state } : { state: 'disconnected' });
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
  challenge,
  loginHint
}: {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
  loginHint?: string;
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
    code_challenge_method: 'S256',
    ...(loginHint ? { login_hint: loginHint } : {})
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
// le pone la dirección de Google cuando está lista
export const connectGoogleCalendar = async (
  { functions }: FirebaseServices,
  { loginHint, signal }: { loginHint?: string; signal?: AbortSignal } = {}
) => {
  if (!CLIENT_ID) throw new Error('La sincronización con Google Calendar no está disponible en esta instalación.');
  const popup = window.open('', 'clar-google-calendar', 'popup,width=520,height=680');
  if (!popup) throw new Error('El navegador bloqueó la ventana de Google. Permite las ventanas emergentes de CLAR.');
  const state = randomString(24);
  const verifier = randomString(48);
  const redirectUri = `${window.location.origin}${OAUTH_CALLBACK_PATH}`;
  popup.location.href = authorizationUrl({
    clientId: CLIENT_ID,
    redirectUri,
    state,
    challenge: await challengeOf(verifier),
    loginHint
  });
  const code = await waitForCode(state, signal);
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

export const disconnectGoogleCalendar = async ({ functions }: FirebaseServices) => {
  await httpsCallable(functions, 'disconnectGoogleCalendar')();
};
