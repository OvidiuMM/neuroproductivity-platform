import { HttpsError, onCall } from 'firebase-functions/https';
import { onDocumentWritten } from 'firebase-functions/firestore';
import * as logger from 'firebase-functions/logger';
import { defineSecret, defineString } from 'firebase-functions/params';
import { adminDb } from './adminApp';
import { REGION, adminEmail, appUrl, isEmulator, requireAuth } from './access';
import { isCurrentAdminMarker } from './accessLogic';
import { buildTaskEvent, eventIdFor, parseConnectRequest, sameEvent, type SyncTask } from './calendarLogic';
import {
  calendarKeySecrets,
  calendarLinkDoc,
  calendarStatusDoc,
  calendarTokenKey,
  disconnectCalendar,
  type CalendarLink,
  type CleanupDeps
} from './calendarCleanup';
import { openToken, parseTokenKey, sealToken } from './calendarCrypto';
import {
  CALENDAR_SCOPE,
  GoogleApiError,
  googleCalendarApi,
  type GoogleCalendarApi,
  type OAuthClient
} from './googleCalendar';

// SINCRONIZACIÓN CON GOOGLE CALENDAR (función extra «Sincronizar con Google Calendar»), en un solo sentido: las tareas
// con fecha de la cuenta van a un calendario propio, «CLAR», en su cuenta de Google. Lo que se cambie en Google no
// vuelve a CLAR.
// - Conectar (connectGoogleCalendar): la app abre la autorización de Google (con PKCE) y envía el código; aquí se
//   canjea por un permiso sin conexión, que se guarda cifrado, se crea el calendario (o se reutiliza el de antes) y se
//   suben todas las tareas con fecha.
// - Cada cambio de una tarea (syncTaskCalendar) crea, actualiza o borra su evento.
// - Desconectar (disconnectGoogleCalendar, o al perder la función o el acceso): se retira el permiso en Google y se
//   borra; el calendario se queda en Google. Ver calendarCleanup.ts.
// Solo sincroniza una cuenta que puede usar la función ahora mismo (calendarEntitled): se comprueba en cada cambio.

// Id del cliente OAuth (web) de Google: no es secreto. El secreto del cliente está en Secret Manager
const clientIdParam = defineString('GOOGLE_OAUTH_CLIENT_ID', {
  default: '',
  description: 'Id del cliente OAuth de Google (aplicación web) para sincronizar con Google Calendar'
});
const clientSecret = defineSecret('GOOGLE_OAUTH_CLIENT_SECRET');
const calendarSecrets = isEmulator ? [] : [clientSecret, calendarTokenKey];

const FEATURE = 'googleCalendar';
const CONCURRENCY = 4;

export interface CalendarDeps extends CleanupDeps {
  api: GoogleCalendarApi;
  client: () => OAuthClient;
  appUrl: () => string;
}
const calendarDeps = (): CalendarDeps => ({
  api: googleCalendarApi,
  client: () => ({ clientId: clientIdParam.value(), clientSecret: clientSecret.value() }),
  key: () => parseTokenKey(calendarTokenKey.value()),
  revoke: (token) => googleCalendarApi.revoke(token),
  appUrl
});

// Si la cuenta puede usar la sincronización ahora mismo: con el acceso aprobado y la función concedida por la
// administración, o si es la administración (con su marca vigente) y la tiene encendida. `featurePrefs` lo puede
// escribir cualquier cuenta en su perfil: solo cuenta para la administración.
export const calendarEntitled = async (uid: string) => {
  const db = adminDb();
  const [access, features, admin, profile] = await Promise.all([
    db.doc(`access/${uid}`).get(),
    db.doc(`features/${uid}`).get(),
    db.doc(`admins/${uid}`).get(),
    db.doc(`users/${uid}`).get()
  ]);
  if (access.data()?.status !== 'approved') return false;
  if (isCurrentAdminMarker(admin.data(), adminEmail()))
    return (profile.data() as { featurePrefs?: Record<string, unknown> } | undefined)?.featurePrefs?.[FEATURE] === true;
  const granted: unknown = features.data()?.granted;
  return Array.isArray(granted) && granted.includes(FEATURE);
};

// Permisos de acceso de cada cuenta (duran una hora), en la memoria de la instancia: así cada cambio no pide uno nuevo
const accessTokens = new Map<string, { token: string; expiresAt: number }>();
const rememberAccessToken = (uid: string, token: string, expiresIn: number) =>
  accessTokens.set(uid, { token, expiresAt: Date.now() + Math.max(0, expiresIn - 120) * 1000 });

// Llama a Google con un permiso de acceso vigente; si Google lo rechaza (p. ej. era de una conexión anterior), lo
// renueva y lo intenta otra vez
const withAccessToken = async (
  uid: string,
  link: CalendarLink,
  deps: CalendarDeps,
  run: (token: string) => Promise<void>
) => {
  const fresh = async () => {
    const { accessToken, expiresIn } = await deps.api.refreshAccessToken(
      deps.client(),
      openToken(link.token, deps.key(), uid)
    );
    rememberAccessToken(uid, accessToken, expiresIn);
    return accessToken;
  };
  const cached = accessTokens.get(uid);
  try {
    await run(cached && cached.expiresAt > Date.now() ? cached.token : await fresh());
  } catch (error) {
    if (!(error instanceof GoogleApiError) || error.status !== 401 || !cached) throw error;
    accessTokens.delete(uid);
    await run(await fresh());
  }
};

// Ante un fallo de Google: si el permiso ya no vale o falta el calendario, la cuenta queda pendiente de volver a
// conectar (y deja de sincronizar); cualquier otro fallo queda en los logs y se arregla con el siguiente cambio
const handleFailure = async (uid: string, error: unknown, deps: CalendarDeps) => {
  if (error instanceof GoogleApiError && (error.reason === 'revoked' || error.reason === 'calendarMissing')) {
    accessTokens.delete(uid);
    await disconnectCalendar(uid, { reason: error.reason, deps });
    logger.warn('Calendar needs reconnecting', { reason: error.reason });
    return 'reconnect' as const;
  }
  logger.error('Calendar sync failed', {
    status: error instanceof GoogleApiError ? error.status : 0,
    reason: error instanceof GoogleApiError ? error.reason : 'unknown'
  });
  return 'failed' as const;
};

// Lleva el estado actual de una tarea a su evento. Lee la tarea justo antes de escribir y la vuelve a leer después:
// si cambió entretanto (dos cambios seguidos, cada uno con su ejecución), escribe otra vez, así el último en terminar
// nunca deja el evento con datos viejos.
export const syncTaskEvent = async (
  uid: string,
  taskId: string,
  deps: CalendarDeps = calendarDeps(),
  knownLink?: CalendarLink
) => {
  const link = knownLink ?? ((await calendarLinkDoc(uid).get()).data() as CalendarLink | undefined);
  if (!link) return 'not-connected' as const;
  if (!(await calendarEntitled(uid))) return 'not-entitled' as const;
  const eventId = eventIdFor(taskId);
  if (!eventId) return 'skipped' as const;
  const taskRef = adminDb().doc(`users/${uid}/tasks/${taskId}`);
  const desired = async () => {
    const task = await taskRef.get();
    return task.exists ? buildTaskEvent(task.data() as SyncTask, link.timeZone, deps.appUrl()) : null;
  };
  try {
    let event = await desired();
    for (let attempt = 0; attempt < 3; attempt++) {
      const target = event;
      await withAccessToken(uid, link, deps, (token) =>
        target
          ? deps.api.putEvent(token, link.calendarId, eventId, target)
          : deps.api.deleteEvent(token, link.calendarId, eventId)
      );
      const now = await desired();
      if (sameEvent(now, target)) break;
      event = now;
    }
    return event ? ('saved' as const) : ('deleted' as const);
  } catch (error) {
    return handleFailure(uid, error, deps);
  }
};

// Sube todas las tareas que van al calendario (al conectar). Un fallo suelto se cuenta y se sigue; si el permiso deja
// de valer, se para
export const syncAllTasks = async (uid: string, link: CalendarLink, deps: CalendarDeps) => {
  const tasks = await adminDb().collection(`users/${uid}/tasks`).get();
  const pending = tasks.docs.flatMap((d) => {
    const eventId = eventIdFor(d.id);
    const event = eventId ? buildTaskEvent(d.data(), link.timeZone, deps.appUrl()) : null;
    return eventId && event ? [{ eventId, event }] : [];
  });
  let synced = 0;
  let failed = 0;
  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    await Promise.all(
      pending.slice(i, i + CONCURRENCY).map(async ({ eventId, event }) => {
        try {
          await withAccessToken(uid, link, deps, (token) => deps.api.putEvent(token, link.calendarId, eventId, event));
          synced++;
        } catch (error) {
          if (error instanceof GoogleApiError && (error.reason === 'revoked' || error.reason === 'calendarMissing'))
            throw error;
          failed++;
        }
      })
    );
  }
  return { synced, failed };
};

// Direcciones a las que Google puede volver con el código: la pública de la app y las de Firebase Hosting
const allowedOrigins = (url: string) => {
  const project = process.env.GCLOUD_PROJECT ?? '';
  return [new URL(url).origin, `https://${project}.web.app`, `https://${project}.firebaseapp.com`];
};

export const connectCalendar = async (uid: string, data: unknown, deps: CalendarDeps) => {
  if (!(await calendarEntitled(uid))) {
    throw new HttpsError('permission-denied', 'Tu cuenta no tiene activada la sincronización con Google Calendar.');
  }
  const input = parseConnectRequest(data, allowedOrigins(deps.appUrl()));
  if (!input) throw new HttpsError('invalid-argument', 'Solicitud no válida.');
  let tokens: Awaited<ReturnType<GoogleCalendarApi['exchangeCode']>>;
  try {
    tokens = await deps.api.exchangeCode(deps.client(), input);
  } catch (error) {
    logger.warn('Calendar authorization not exchanged', { reason: (error as { reason?: string }).reason ?? 'unknown' });
    throw new HttpsError('invalid-argument', 'Google no aceptó la autorización. Vuelve a intentarlo.');
  }
  // Sin el permiso del calendario (Google deja desmarcarlo) o sin permiso sin conexión, no hay nada que guardar
  const refreshToken = tokens.refreshToken;
  if (!tokens.scope.split(' ').includes(CALENDAR_SCOPE) || !refreshToken) {
    await deps.api.revoke(refreshToken ?? tokens.accessToken).catch(() => undefined);
    throw new HttpsError(
      'permission-denied',
      refreshToken
        ? 'Para sincronizar, deja marcado el permiso de Google Calendar.'
        : 'Google no dio el permiso para sincronizar con CLAR cerrada. Vuelve a intentarlo.'
    );
  }
  // Volver a conectar: el permiso nuevo sustituye al anterior (retirar el anterior retiraría también el nuevo)
  const previous = (await calendarStatusDoc(uid).get()).data() as { calendarId?: string } | undefined;
  const calendarId = await deps.api.ensureCalendar(tokens.accessToken, input.timeZone, previous?.calendarId);
  const connectedAt = new Date().toISOString();
  const link: CalendarLink = {
    token: sealToken(refreshToken, deps.key(), uid),
    calendarId,
    timeZone: input.timeZone,
    connectedAt
  };
  await calendarLinkDoc(uid).set(link);
  rememberAccessToken(uid, tokens.accessToken, tokens.expiresIn);
  await calendarStatusDoc(uid).set({ state: 'syncing', calendarId, connectedAt, updatedAt: connectedAt });
  // Si entretanto le quitaron la función, no se queda conectada
  if (!(await calendarEntitled(uid))) {
    await disconnectCalendar(uid, { deps });
    throw new HttpsError('permission-denied', 'Tu cuenta ya no tiene activada la sincronización con Google Calendar.');
  }
  try {
    const { synced, failed } = await syncAllTasks(uid, link, deps);
    const syncedAt = new Date().toISOString();
    await calendarStatusDoc(uid).set({
      state: 'connected',
      calendarId,
      connectedAt,
      syncedAt,
      ...(failed ? { failed } : {}),
      updatedAt: syncedAt
    });
    logger.info('Calendar connected', { synced, failed });
    return { synced, failed };
  } catch (error) {
    await handleFailure(uid, error, deps);
    throw new HttpsError(
      'failed-precondition',
      'Google retiró el permiso mientras se subían las tareas. Vuelve a conectar.'
    );
  }
};

export const connectGoogleCalendar = onCall(
  { region: REGION, secrets: calendarSecrets, timeoutSeconds: 540 },
  async (request) => {
    const auth = requireAuth(request);
    if (isEmulator || !clientIdParam.value()) {
      throw new HttpsError(
        'failed-precondition',
        'La sincronización con Google Calendar no está disponible en esta instalación.'
      );
    }
    return connectCalendar(auth.uid, request.data, calendarDeps());
  }
);

export const disconnectGoogleCalendar = onCall({ region: REGION, secrets: calendarKeySecrets }, async (request) => {
  const auth = requireAuth(request);
  await disconnectCalendar(auth.uid);
  logger.info('Calendar disconnected', { reason: 'user' });
  return { ok: true };
});

// Cada cambio de una tarea, en su evento. Casi ninguna cuenta está conectada: lo primero es comprobarlo. Un cambio que
// no afecta al evento (p. ej. la prioridad) no llama a Google
export const syncTaskCalendar = onDocumentWritten(
  { document: 'users/{uid}/tasks/{taskId}', region: REGION, secrets: calendarSecrets },
  async (event) => {
    const { uid, taskId } = event.params;
    const link = (await calendarLinkDoc(uid).get()).data() as CalendarLink | undefined;
    if (!link) return;
    const before = event.data?.before.data() as SyncTask | undefined;
    const after = event.data?.after.data() as SyncTask | undefined;
    const url = appUrl();
    if (
      sameEvent(
        before ? buildTaskEvent(before, link.timeZone, url) : null,
        after ? buildTaskEvent(after, link.timeZone, url) : null
      )
    )
      return;
    await syncTaskEvent(uid, taskId, calendarDeps(), link);
  }
);

// Al perder la función (la administración se la quita, o la administración apaga su interruptor) se desconecta. Si la
// pierde porque pierde el acceso, también: sus funciones extra se borran con la decisión (ver access.ts)
const disconnectIfNotEntitled = async (uid: string) => {
  if (await calendarEntitled(uid)) return;
  await disconnectCalendar(uid);
  logger.info('Calendar disconnected', { reason: 'feature' });
};

const hasCalendar = (data: { granted?: unknown } | undefined) =>
  Array.isArray(data?.granted) && data.granted.includes(FEATURE);

export const calendarFeatureChanged = onDocumentWritten(
  { document: 'features/{uid}', region: REGION, secrets: calendarKeySecrets },
  async (event) => {
    if (hasCalendar(event.data?.before.data()) && !hasCalendar(event.data?.after.data()))
      await disconnectIfNotEntitled(event.params.uid);
  }
);

const prefOn = (data: { featurePrefs?: Record<string, unknown> } | undefined) => data?.featurePrefs?.[FEATURE] === true;

export const calendarPrefChanged = onDocumentWritten(
  { document: 'users/{uid}', region: REGION, secrets: calendarKeySecrets },
  async (event) => {
    if (prefOn(event.data?.before.data()) && !prefOn(event.data?.after.data()))
      await disconnectIfNotEntitled(event.params.uid);
  }
);
