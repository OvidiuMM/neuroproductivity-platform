import * as logger from 'firebase-functions/logger';
import { defineSecret } from 'firebase-functions/params';
import { adminDb } from './adminApp';
import { openToken, parseTokenKey, type SealedToken } from './calendarCrypto';
import { googleCalendarApi } from './googleCalendar';

// SINCRONIZACIÓN CON GOOGLE CALENDAR (ver calendarSync.ts): dónde se guarda la conexión de cada cuenta y cómo se
// desconecta. Va aparte de calendarSync.ts para que access.ts lo use sin importarlo (calendarSync.ts importa de
// access.ts).
// - calendar_tokens/{uid}: el permiso de Google (cifrado), el calendario «CLAR» y la zona horaria. Solo el servidor.
// - calendar_status/{uid}: lo que ve la cuenta (sincronizando, conectada, hay que volver a conectar o desconectada) y el
//   id de su calendario «CLAR», para seguir usándolo al volver a conectar. Lo escribe el servidor y lo lee la cuenta.

// Clave del cifrado de los permisos (32 bytes en base64), en Secret Manager. En los emuladores no se enlaza: no hay
// permisos de Google que descifrar
export const calendarTokenKey = defineSecret('CALENDAR_TOKEN_KEY');
const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
export const calendarKeySecrets = isEmulator ? [] : [calendarTokenKey];

export type CalendarState = 'syncing' | 'connected' | 'needsReconnect' | 'disconnected';
export type ReconnectReason = 'revoked' | 'calendarMissing';

export interface CalendarLink {
  token: SealedToken;
  calendarId: string;
  timeZone: string;
  connectedAt: string;
}

export const calendarLinkDoc = (uid: string) => adminDb().doc(`calendar_tokens/${uid}`);
export const calendarStatusDoc = (uid: string) => adminDb().doc(`calendar_status/${uid}`);

export interface CleanupDeps {
  revoke: (token: string) => Promise<void>;
  key: () => Buffer;
}
const cleanupDeps = (): CleanupDeps => ({
  revoke: (token) => googleCalendarApi.revoke(token),
  key: () => parseTokenKey(calendarTokenKey.value())
});

// Desconecta la cuenta: retira el permiso en Google (si se puede) y borra el token. El calendario «CLAR» se queda en la
// cuenta de Google de la persona, que puede borrarlo. Con `forget` (al eliminar la cuenta) se borra también el estado;
// si no, queda como desconectada o, con `reason`, como pendiente de volver a conectar. Con `onlyConnection` (el
// `connectedAt` de la conexión que falló), solo si sigue siendo esa: un fallo que llega tarde no deshace una
// desconexión ni una conexión más nueva. Devuelve si desconectó.
export const disconnectCalendar = async (
  uid: string,
  {
    forget = false,
    reason,
    onlyConnection,
    deps = cleanupDeps()
  }: { forget?: boolean; reason?: ReconnectReason; onlyConnection?: string; deps?: CleanupDeps } = {}
) => {
  const link = (await calendarLinkDoc(uid).get()).data() as CalendarLink | undefined;
  if (onlyConnection !== undefined && link?.connectedAt !== onlyConnection) return false;
  // Un permiso que Google ya retiró (o que ya no se puede leer) no hace falta retirarlo
  if (link?.token && reason !== 'revoked') {
    try {
      await deps.revoke(openToken(link.token, deps.key(), uid));
    } catch (error) {
      logger.warn('Calendar permission not revoked', { code: (error as { reason?: string }).reason ?? 'unknown' });
    }
  }
  if (forget) {
    await Promise.all([calendarLinkDoc(uid).delete(), calendarStatusDoc(uid).delete()]);
    return true;
  }
  // En la misma transacción que comprueba que la cuenta sigue existiendo: una sincronización que acaba después de
  // eliminarla no deja nada (forgetAccess borra su solicitud de acceso antes que esto)
  return adminDb().runTransaction(async (tx) => {
    const [access, statusSnap, current] = await Promise.all([
      tx.get(adminDb().doc(`access/${uid}`)),
      tx.get(calendarStatusDoc(uid)),
      tx.get(calendarLinkDoc(uid))
    ]);
    if (onlyConnection !== undefined && (current.data() as CalendarLink | undefined)?.connectedAt !== onlyConnection)
      return false;
    tx.delete(calendarLinkDoc(uid));
    const status = statusSnap.data() as { calendarId?: string } | undefined;
    // Cuenta eliminada, o nunca conectada: nada que apuntar
    if (!access.exists || (!link && !status)) return true;
    const calendarId = link?.calendarId ?? status?.calendarId;
    tx.set(calendarStatusDoc(uid), {
      state: reason ? 'needsReconnect' : 'disconnected',
      ...(reason ? { reason } : {}),
      ...(calendarId ? { calendarId } : {}),
      updatedAt: new Date().toISOString()
    });
    return true;
  });
};
