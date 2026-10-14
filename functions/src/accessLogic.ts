// Reglas de la aprobación de accesos, sin dependencias de Firebase para poder probarlas aisladas

// blocked: lista negra. No puede volver a pedir acceso, ni entrar sola con la aprobación libre; también se bloquea su
// email, así que tampoco puede volver con otra cuenta
export type AccessStatus = 'pending' | 'approved' | 'rejected' | 'revoked' | 'blocked';
export type DecisionStatus = Exclude<AccessStatus, 'pending'>;

// Documento access/{uid}: solo lo escriben las Cloud Functions
export interface AccessRecord {
  status: AccessStatus;
  email: string;
  name: string;
  photoUrl: string;
  message: string;
  requestedAt: string;
  decidedAt?: string;
}

export interface AuthToken {
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export const MESSAGE_MAX_LENGTH = 500;
// Tras un rechazo o una retirada se puede volver a pedir acceso pasado un día
export const REQUEST_COOLDOWN_MS = 24 * 60 * 60 * 1000;
// En los proyectos demo (emuladores) esta cuenta hace de administración
export const DEMO_ADMIN_EMAIL = 'admin@example.com';
export const DECISIONS: readonly DecisionStatus[] = ['approved', 'rejected', 'revoked', 'blocked'];

export const normalizeEmail = (email?: string | null) => (email ?? '').trim().toLowerCase();

export const normalizeMessage = (value: unknown) =>
  typeof value === 'string' ? value.trim().slice(0, MESSAGE_MAX_LENGTH) : '';

export const profileOf = (token: AuthToken) => ({
  email: normalizeEmail(token.email),
  name: (token.name ?? '').slice(0, 200),
  photoUrl: token.picture ?? ''
});

// La administración es la cuenta con el email configurado, siempre que Google lo haya verificado
export const isAdminToken = (token: AuthToken | undefined, adminEmail: string) =>
  Boolean(adminEmail) && token?.email_verified === true && normalizeEmail(token.email) === normalizeEmail(adminEmail);

// Marca admins/{uid} válida: la de la cuenta configurada. Las demás (p. ej. tras cambiar ADMIN_EMAIL) se borran.
export const isCurrentAdminMarker = (marker: { email?: unknown } | undefined, adminEmail: string) =>
  Boolean(adminEmail) &&
  typeof marker?.email === 'string' &&
  normalizeEmail(marker.email) === normalizeEmail(adminEmail);

export type RequestDecision =
  { action: 'create' } | { action: 'keep'; status: AccessStatus } | { action: 'wait'; retryAt: string };

// Qué hacer cuando alguien pide acceso según el estado actual de su solicitud
export const decideRequest = (current: AccessRecord | undefined, now: Date): RequestDecision => {
  if (!current) return { action: 'create' };
  if (current.status === 'pending' || current.status === 'approved' || current.status === 'blocked') {
    return { action: 'keep', status: current.status };
  }
  const retryAt = Date.parse(current.decidedAt ?? current.requestedAt) + REQUEST_COOLDOWN_MS;
  return now.getTime() >= retryAt ? { action: 'create' } : { action: 'wait', retryAt: new Date(retryAt).toISOString() };
};

// Aprobar desde cualquier estado no aprobado (también desbloquea), rechazar solo pendientes, retirar a quien tiene
// acceso o está bloqueado (desbloquear sin dar acceso) y bloquear desde cualquier otro estado
export const canDecide = (from: AccessStatus, to: DecisionStatus) =>
  (to === 'approved' && from !== 'approved') ||
  (to === 'rejected' && from === 'pending') ||
  (to === 'revoked' && (from === 'approved' || from === 'blocked')) ||
  (to === 'blocked' && from !== 'blocked');

// Qué hacer con el acceso de una cuenta al entrar (syncAccess), según el modo de aprobación:
// - email en la lista negra: se bloquea la cuenta (si aún no lo está);
// - aprobación libre: una cuenta sin solicitud o pendiente, con el email confirmado, entra sola. Las rechazadas,
//   retiradas o bloqueadas siguen así: son decisiones de la administración.
export type SyncAction = 'keep' | 'approve' | 'block';
export const decideOnSync = ({
  current,
  approvalRequired,
  emailBlocked,
  emailVerified
}: {
  current: AccessStatus | undefined;
  approvalRequired: boolean;
  emailBlocked: boolean;
  emailVerified: boolean;
}): SyncAction => {
  if (emailBlocked) return current === 'blocked' ? 'keep' : 'block';
  if (approvalRequired || !emailVerified) return 'keep';
  return current === undefined || current === 'pending' ? 'approve' : 'keep';
};

// Dirección de la app en los emails: la configurada (APP_URL, p. ej. https://clar.life) si es https; si no, la de
// Firebase Hosting del proyecto
export const publicAppUrl = (configured: string, projectId: string) => {
  const url = configured.trim().replace(/\/+$/, '');
  return /^https:\/\/[^/\s]+/.test(url) ? url : `https://${projectId}.web.app`;
};

// Avisos: a la administración por cada solicitud nueva y a la persona cuando se aprueba su acceso
export type AccessEmail = 'new-request' | 'approved';

// Correos solo en texto plano: el nombre y el mensaje los escribe la persona que pide acceso
export const buildEmail = (kind: AccessEmail, record: AccessRecord, appUrl: string) =>
  kind === 'new-request'
    ? {
        subject: 'Nueva solicitud de acceso a CLAR',
        text: [
          `${record.name || 'Alguien'} (${record.email}) quiere acceder a CLAR.`,
          record.message ? `\nMensaje:\n${record.message}` : '',
          `\nRevísala en «Administración» → «Solicitudes»: ${appUrl}`
        ].join('\n')
      }
    : {
        subject: 'Ya tienes acceso a CLAR',
        text: [
          `Hola${record.name ? ` ${record.name}` : ''}:`,
          '',
          'Tu solicitud de acceso a CLAR está aprobada. Ya puedes entrar con la misma cuenta con la que la pediste:',
          appUrl
        ].join('\n')
      };
