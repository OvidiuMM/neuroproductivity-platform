import { messages, type Language } from './i18n';

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
  // Pendiente tras un rechazo o una retirada: la decide la administración también con la aprobación libre
  review?: boolean;
  // El idioma de la app al pedir acceso (desde 1.2.0): el del aviso de aprobación si la cuenta aún no tiene el suyo
  language?: Language;
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
  | { action: 'create' }
  | { action: 'approve' }
  | { action: 'keep'; status: AccessStatus }
  | { action: 'wait'; retryAt: string };

// Qué hacer cuando alguien pide acceso según el estado actual de su solicitud y el modo de aprobación
export const decideRequest = (
  current: AccessRecord | undefined,
  now: Date,
  approvalRequired = true
): RequestDecision => {
  if (!current) return { action: 'create' };
  // Con la aprobación libre, una solicitud que seguía pendiente (p. ej. si el aprobado en bloque se interrumpió) se
  // aprueba ya, como al entrar; salvo si es la de una cuenta rechazada o retirada (review)
  if (current.status === 'pending' && !approvalRequired && !current.review) return { action: 'approve' };
  if (current.status === 'pending' || current.status === 'approved' || current.status === 'blocked') {
    return { action: 'keep', status: current.status };
  }
  const retryAt = Date.parse(current.decidedAt ?? current.requestedAt) + REQUEST_COOLDOWN_MS;
  return now.getTime() >= retryAt ? { action: 'create' } : { action: 'wait', retryAt: new Date(retryAt).toISOString() };
};

// Estado de una solicitud nueva: con la aprobación libre, una cuenta que nunca pidió acceso entra sola; una que fue
// rechazada o retirada y vuelve a pedirlo espera a la administración, en cualquier modo (fue su decisión)
export const newRequestStatus = (previous: AccessRecord | undefined, approvalRequired: boolean) =>
  !approvalRequired && !previous ? ('approved' as const) : ('pending' as const);

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
//   retiradas o bloqueadas siguen así, también si vuelven a pedir acceso (review): son decisiones de la administración.
// Inicio de sesión reciente (auth_time del token, en segundos): lo pide eliminar la cuenta, como Firebase en el navegador
export const RECENT_SIGN_IN_SECONDS = 5 * 60;
export const isRecentSignIn = (authTime: unknown, now: Date) =>
  typeof authTime === 'number' &&
  authTime <= now.getTime() / 1000 + 60 &&
  now.getTime() / 1000 - authTime <= RECENT_SIGN_IN_SECONDS;

export type SyncAction = 'keep' | 'approve' | 'block';
export const decideOnSync = ({
  current,
  review = false,
  approvalRequired,
  emailBlocked,
  emailVerified
}: {
  current: AccessStatus | undefined;
  review?: boolean;
  approvalRequired: boolean;
  emailBlocked: boolean;
  emailVerified: boolean;
}): SyncAction => {
  if (emailBlocked) return current === 'blocked' ? 'keep' : 'block';
  if (approvalRequired || !emailVerified) return 'keep';
  return current === undefined || (current === 'pending' && !review) ? 'approve' : 'keep';
};

// Dirección de la app en los emails: la configurada (APP_URL, p. ej. https://clar.life) si es una dirección https
// completa y válida, sin usuario, consulta ni fragmento; si no, la de Firebase Hosting del proyecto
export const publicAppUrl = (configured: string, projectId: string) => {
  const fallback = `https://${projectId}.web.app`;
  const value = configured.trim();
  if (!value || /\s/.test(value)) return fallback;
  try {
    const url = new URL(value);
    const plain = url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash;
    return plain ? url.href.replace(/\/+$/, '') : fallback;
  } catch {
    return fallback;
  }
};

// Avisos: a la administración por cada solicitud nueva y a la persona cuando se aprueba su acceso
export type AccessEmail = 'new-request' | 'approved';

// El aviso de aprobación, en el idioma de la persona
const approvedEmail = messages(
  {
    subject: 'Ya tienes acceso a CLAR',
    greeting: (name: string) => `Hola${name ? ` ${name}` : ''}:`,
    body: 'Tu solicitud de acceso a CLAR está aprobada. Ya puedes entrar con la misma cuenta con la que la pediste:'
  },
  {
    subject: 'You now have access to CLAR',
    greeting: (name) => `Hi${name ? ` ${name}` : ''},`,
    body: 'Your request for access to CLAR has been approved. You can now sign in with the same account you used to request it:'
  }
);

// Correos solo en texto plano. El aviso a la administración no lleva datos de quien pide acceso (minimización): se
// leen en la app. Va siempre en español; el de aprobación, en el idioma de la persona (`language`)
export const buildEmail = (kind: AccessEmail, record: AccessRecord, appUrl: string, language: Language = 'es') => {
  if (kind === 'new-request')
    return {
      subject: 'Nueva solicitud de acceso a CLAR',
      text: `Hay una solicitud de acceso nueva. Revísala en «Administración» → «Solicitudes»: ${appUrl}`
    };
  const t = approvedEmail[language];
  return { subject: t.subject, text: [t.greeting(record.name), '', t.body, appUrl].join('\n') };
};
