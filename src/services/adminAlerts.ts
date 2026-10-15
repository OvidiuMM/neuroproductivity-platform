import type { AccessRequest } from './access';
import type { FeedbackTicket } from './feedbackApi';

// AVISOS DE LA ADMINISTRACIÓN (en rojo, en «Administración» y en sus pestañas): solicitudes por decidir, mensajes sin
// leer y cuentas nuevas que entraron solas (con la aprobación desactivada) desde la última vez que se miraron las
// solicitudes en este dispositivo
export const adminAlerts = (
  requests: Pick<AccessRequest, 'status' | 'requestedAt'>[],
  tickets: Pick<FeedbackTicket, 'status'>[],
  requestsSeenAt: string
) => {
  const pending = requests.filter((r) => r.status === 'pending').length;
  const newAccounts = requests.filter((r) => r.status === 'approved' && r.requestedAt > requestsSeenAt).length;
  const unread = tickets.filter((t) => t.status === 'new').length;
  return { pending, newAccounts, unread, total: pending + newAccounts + unread };
};

// Cuándo se miraron por última vez las solicitudes, por cuenta y dispositivo
export const requestsSeenKey = (uid: string) => `clar_admin_requests_seen:${uid}`;
