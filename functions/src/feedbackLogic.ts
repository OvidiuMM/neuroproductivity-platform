import { languageOf, messages, type Language } from './i18n';

// Reglas puras de los mensajes de contacto (sin dependencias de Firebase, para probarlas aisladas)

export const FEEDBACK_TYPES = ['suggestion', 'bug', 'general'] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];
export type FeedbackStatus = 'new' | 'read' | 'closed';

export const SUBJECT_MAX_LENGTH = 120;
export const DESCRIPTION_MAX_LENGTH = 2000;
// Como mucho 5 mensajes por hora y cuenta
export const FEEDBACK_LIMIT = 5;
export const FEEDBACK_WINDOW_MS = 60 * 60 * 1000;

const DEVICE_CLASSES = ['móvil', 'tableta', 'escritorio'] as const;

// Información técnica opcional y anónima que adjunta la app (nunca el user-agent completo)
export interface FeedbackContext {
  appVersion: string;
  os: string;
  browser: string;
  deviceClass: (typeof DEVICE_CLASSES)[number];
  language: string;
  online: boolean;
}

export interface FeedbackInput {
  type: FeedbackType;
  subject: string;
  description: string;
  context?: FeedbackContext;
}

// Respuesta de la administración, enviada por email a quien escribió. El id lo pone la app y se repite en los
// reintentos: así una respuesta nunca sale dos veces.
export interface FeedbackReply {
  id: string;
  message: string;
  sentAt: string;
}

export interface FeedbackTicket extends FeedbackInput {
  uid: string;
  email: string;
  name: string;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
  replies?: FeedbackReply[];
  // Respuestas que se están enviando (id → cuándo empezó); se borran al guardarlas o si el envío falla
  pendingReplies?: Record<string, string>;
  // El idioma de quien escribió (desde 1.2.0; sin él, español): el de la respuesta por email
  language?: Language;
}

export const REPLY_MAX_LENGTH = 5000;

// Texto sin caracteres de control (los saltos de línea solo donde se permiten), recortado y con su límite
// eslint-disable-next-line no-control-regex -- justo lo que se busca: caracteres de control
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const cleanText = (value: unknown, max: number, singleLine = false) => {
  if (typeof value !== 'string') return '';
  const text = value.replace(CONTROL, '');
  return (singleLine ? text.replace(/[\r\n]+/g, ' ') : text).trim().slice(0, max);
};

// Solo los campos conocidos y con valores razonables; si algo no encaja, se descarta todo el contexto
export const parseContext = (value: unknown): FeedbackContext | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  const deviceClass = DEVICE_CLASSES.find((d) => d === v.deviceClass);
  if (!deviceClass || typeof v.online !== 'boolean') return undefined;
  const context = {
    appVersion: cleanText(v.appVersion, 20, true),
    os: cleanText(v.os, 40, true),
    browser: cleanText(v.browser, 40, true),
    deviceClass,
    language: cleanText(v.language, 20, true),
    online: v.online
  };
  return context.appVersion && context.os && context.browser && context.language ? context : undefined;
};

// Mensaje válido, o null si falta el tipo, el asunto o la descripción
export const parseFeedback = (data: unknown): FeedbackInput | null => {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const type = FEEDBACK_TYPES.find((t) => t === d.type);
  const subject = cleanText(d.subject, SUBJECT_MAX_LENGTH, true);
  const description = cleanText(d.description, DESCRIPTION_MAX_LENGTH);
  if (!type || !subject || !description) return null;
  const context = parseContext(d.context);
  return context ? { type, subject, description, context } : { type, subject, description };
};

// Respuesta válida de la administración, o null: el id de un mensaje y un texto no vacío
export const parseReply = (data: unknown): { ticketId: string; replyId: string; message: string } | null => {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const ticketId = typeof d.ticketId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(d.ticketId) ? d.ticketId : '';
  const replyId = typeof d.replyId === 'string' && /^[A-Za-z0-9]{8,64}$/.test(d.replyId) ? d.replyId : '';
  const message = cleanText(d.message, REPLY_MAX_LENGTH);
  return ticketId && replyId && message ? { ticketId, replyId, message } : null;
};

// Antes de enviar una respuesta: ya enviada y guardada (se devuelve sin reenviarla), a medias (empezó a enviarse y no
// se sabe si salió: no se reenvía) o nueva
export type ReplyState = { kind: 'sent'; reply: FeedbackReply } | { kind: 'uncertain' } | { kind: 'new' };
export const replyState = (ticket: Pick<FeedbackTicket, 'replies' | 'pendingReplies'>, replyId: string): ReplyState => {
  const sent = ticket.replies?.find((r) => r.id === replyId);
  if (sent) return { kind: 'sent', reply: sent };
  return ticket.pendingReplies?.[replyId] ? { kind: 'uncertain' } : { kind: 'new' };
};

// Envíos de la última hora (los anteriores ya no cuentan para el límite)
export const recentSends = (sent: string[], now: Date) =>
  sent.filter((at) => {
    const time = Date.parse(at);
    return Number.isFinite(time) && now.getTime() - time < FEEDBACK_WINDOW_MS;
  });

// Los nombres de los tipos, como en la app (src/services/feedback.ts)
const TYPE_LABELS = messages<Record<FeedbackType, string>>(
  { suggestion: 'Sugerencia', bug: 'Error o fallo', general: 'Mensaje general' },
  { suggestion: 'Suggestion', bug: 'Bug or problem', general: 'General message' }
);
// Los avisos a la administración, siempre en español
const TYPE_LABEL = TYPE_LABELS.es;

// Aviso a la administración, en texto plano y sin datos de quien escribe ni su mensaje (minimización): se leen y se
// contestan en la app
// earlier: los que llegaron desde el aviso anterior y aún esperaban al resumen; van en este
export const buildFeedbackEmail = (ticket: FeedbackTicket, appUrl: string, earlier = 0) => ({
  subject: `[CLAR] Mensaje nuevo: ${TYPE_LABEL[ticket.type]}`,
  text: `Hay un mensaje nuevo (${TYPE_LABEL[ticket.type]})${
    earlier > 0 ? ` y ${earlier === 1 ? 'otro de antes' : `${earlier} más de antes`}` : ''
  }. Léelo y contesta en «Administración» → «Mensajes»: ${appUrl}`
});

// Avisos a la administración: como mucho uno cada 15 minutos (con el registro abierto podrían llegar muchos). Un mensaje
// que llega antes se apunta y sale en el resumen siguiente (flushFeedbackNotices)
export const NOTICE_INTERVAL_MS = 15 * 60 * 1000;
// slackMs: margen para el resumen programado, que también va cada 15 minutos y no arranca siempre al mismo segundo
export const noticeDue = (lastSentAt: unknown, now: Date, slackMs = 0) => {
  const last = typeof lastSentAt === 'string' ? Date.parse(lastSentAt) : NaN;
  return !Number.isFinite(last) || now.getTime() - last >= NOTICE_INTERVAL_MS - slackMs;
};

export const buildFeedbackDigestEmail = (count: number, appUrl: string) => ({
  subject: `[CLAR] ${count === 1 ? 'Un mensaje nuevo' : `${count} mensajes nuevos`}`,
  text: `Hay ${count === 1 ? 'un mensaje nuevo' : `${count} mensajes nuevos`} desde el último aviso. Léelos y contesta en «Administración» → «Mensajes»: ${appUrl}`
});

const replyEmail = messages(
  {
    greeting: (name: string) => (name ? `Hola, ${name}:` : 'Hola:'),
    team: 'Equipo de CLAR',
    yourMessage: (type: string) => `Tu mensaje (${type}):`
  },
  {
    greeting: (name) => (name ? `Hi ${name},` : 'Hi,'),
    team: 'The CLAR team',
    yourMessage: (type) => `Your message (${type}):`
  }
);

// Respuesta a quien escribió, en texto plano, en su idioma y con su mensaje citado. Si contesta, le llega al buzón que
// la envía.
export const buildReplyEmail = (ticket: FeedbackTicket, message: string, appUrl: string) => {
  const language = languageOf(ticket.language);
  const t = replyEmail[language];
  return {
    subject: `Re: [CLAR] ${ticket.subject}`,
    text: [
      t.greeting(ticket.name),
      '',
      message,
      '',
      '—',
      t.team,
      appUrl,
      '',
      t.yourMessage(TYPE_LABELS[language][ticket.type]),
      `> ${ticket.subject}`,
      '>',
      ...ticket.description.split(/\r?\n/).map((line) => (line ? `> ${line}` : '>'))
    ].join('\n')
  };
};
