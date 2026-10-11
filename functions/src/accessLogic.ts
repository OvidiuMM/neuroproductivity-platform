// Reglas de la aprobación de accesos, sin dependencias de Firebase para poder probarlas aisladas

export type AccessStatus = 'pending' | 'approved' | 'rejected' | 'revoked';
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
export const DECISIONS: readonly DecisionStatus[] = ['approved', 'rejected', 'revoked'];

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
  Boolean(adminEmail) && typeof marker?.email === 'string' && normalizeEmail(marker.email) === normalizeEmail(adminEmail);

export type RequestDecision =
  | { action: 'create' }
  | { action: 'keep'; status: AccessStatus }
  | { action: 'wait'; retryAt: string };

// Qué hacer cuando alguien pide acceso según el estado actual de su solicitud
export const decideRequest = (current: AccessRecord | undefined, now: Date): RequestDecision => {
  if (!current) return { action: 'create' };
  if (current.status === 'pending' || current.status === 'approved') return { action: 'keep', status: current.status };
  const retryAt = Date.parse(current.decidedAt ?? current.requestedAt) + REQUEST_COOLDOWN_MS;
  return now.getTime() >= retryAt ? { action: 'create' } : { action: 'wait', retryAt: new Date(retryAt).toISOString() };
};

// Aprobar desde cualquier estado no aprobado, rechazar solo pendientes y retirar solo aprobados
export const canDecide = (from: AccessStatus, to: DecisionStatus) =>
  (to === 'approved' && from !== 'approved') ||
  (to === 'rejected' && from === 'pending') ||
  (to === 'revoked' && from === 'approved');

// Avisos: a la administración por cada solicitud nueva y a la persona cuando se aprueba su acceso
export type AccessEmail = 'new-request' | 'approved';

// Correos solo en texto plano: el nombre y el mensaje los escribe la persona que pide acceso
export const buildEmail = (kind: AccessEmail, record: AccessRecord, appUrl: string) =>
  kind === 'new-request'
    ? {
        subject: 'Nueva solicitud de acceso a NeuroProductividad',
        text: [
          `${record.name || 'Alguien'} (${record.email}) quiere acceder a NeuroProductividad.`,
          record.message ? `\nMensaje:\n${record.message}` : '',
          `\nRevisa la solicitud en la pestaña «Accesos»: ${appUrl}`
        ].join('\n')
      }
    : {
        subject: 'Ya tienes acceso a NeuroProductividad',
        text: [
          `Hola${record.name ? ` ${record.name}` : ''}:`,
          '',
          'Tu solicitud de acceso a NeuroProductividad está aprobada. Ya puedes entrar con tu cuenta de Google:',
          appUrl
        ].join('\n')
      };
