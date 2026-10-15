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

// Respuesta de la administración, enviada por email a quien escribió
export interface FeedbackReply {
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
export const parseReply = (data: unknown): { ticketId: string; message: string } | null => {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const ticketId = typeof d.ticketId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(d.ticketId) ? d.ticketId : '';
  const message = cleanText(d.message, REPLY_MAX_LENGTH);
  return ticketId && message ? { ticketId, message } : null;
};

// Envíos de la última hora (los anteriores ya no cuentan para el límite)
export const recentSends = (sent: string[], now: Date) =>
  sent.filter((at) => {
    const time = Date.parse(at);
    return Number.isFinite(time) && now.getTime() - time < FEEDBACK_WINDOW_MS;
  });

const TYPE_LABEL: Record<FeedbackType, string> = {
  suggestion: 'Sugerencia',
  bug: 'Error o fallo',
  general: 'Mensaje general'
};

// Correo a la administración, solo en texto plano: asunto y descripción los escribe quien envía el mensaje
export const buildFeedbackEmail = (ticket: FeedbackTicket, appUrl: string) => ({
  subject: `[CLAR] ${TYPE_LABEL[ticket.type]}: ${ticket.subject}`,
  replyTo: ticket.email,
  text: [
    `${ticket.name || 'Alguien'} (${ticket.email}) ha escrito desde CLAR.`,
    '',
    `Tipo: ${TYPE_LABEL[ticket.type]}`,
    `Asunto: ${ticket.subject}`,
    '',
    ticket.description,
    ...(ticket.context
      ? [
          '',
          'Información técnica:',
          `- Versión: ${ticket.context.appVersion}`,
          `- Sistema: ${ticket.context.os}`,
          `- Navegador: ${ticket.context.browser}`,
          `- Dispositivo: ${ticket.context.deviceClass}`,
          `- Idioma: ${ticket.context.language}`,
          `- Conexión: ${ticket.context.online ? 'sí' : 'no'}`
        ]
      : []),
    '',
    `Responde a este correo para contestar, o míralo en «Administración» → «Mensajes»: ${appUrl}`
  ].join('\n')
});

// Respuesta a quien escribió, en texto plano y con su mensaje citado. Si contesta, le llega a la administración.
export const buildReplyEmail = (ticket: FeedbackTicket, message: string, adminEmail: string) => ({
  subject: `Re: [CLAR] ${ticket.subject}`,
  replyTo: adminEmail,
  text: [
    ticket.name ? `Hola, ${ticket.name}:` : 'Hola:',
    '',
    message,
    '',
    '—',
    'Equipo de CLAR',
    '',
    `Tu mensaje (${TYPE_LABEL[ticket.type]}):`,
    `> ${ticket.subject}`,
    '>',
    ...ticket.description.split(/\r?\n/).map((line) => (line ? `> ${line}` : '>'))
  ].join('\n')
});
