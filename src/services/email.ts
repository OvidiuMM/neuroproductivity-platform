import type { EmailDraft } from '../types';

// CORREO («Tiempo protegido»): CLAR no lo envía; lo redacta en orden (adjuntos, texto, asunto y, al final,
// destinatarios), lo guarda y lo pasa al programa de correo para enviarlo.
export const EMAIL_BODY_MIN = 15;
export const EMAIL_SUBJECT_MIN = 4;

const ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const parseRecipients = (input: string) =>
  input
    .split(/[,;\s]+/)
    .map((address) => address.trim())
    .filter(Boolean);

export const areValidRecipients = (recipients: string[]) =>
  recipients.length > 0 && recipients.every((address) => ADDRESS.test(address));

// Tamaño legible de un archivo: «820 B», «12 KB», «1,2 MB»
export const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const number = new Intl.NumberFormat('es-ES', { maximumFractionDigits: value < 10 ? 1 : 0 }).format(value);
  return `${number} ${units[unit]}`;
};

// Enlace que abre el correo en el programa de correo con los destinatarios válidos, el asunto y el texto. Los
// adjuntos no caben en un enlace: se añaden allí.
export const buildMailto = ({ recipients, subject, body }: Pick<EmailDraft, 'recipients' | 'subject' | 'body'>) => {
  const to = recipients
    .filter((address) => ADDRESS.test(address))
    .map((address) => encodeURIComponent(address).replace(/%40/g, '@'))
    .join(',');
  const params = [
    subject.trim() && `subject=${encodeURIComponent(subject.trim())}`,
    // Saltos de línea como CRLF, como pide el estándar de los enlaces mailto
    body.trim() && `body=${encodeURIComponent(body.trim().replace(/\r?\n/g, '\r\n'))}`
  ].filter(Boolean);
  return `mailto:${to}${params.length ? `?${params.join('&')}` : ''}`;
};

// Mismo archivo: mismo nombre y mismos bytes. Los adjuntos de antes de 0.9.2 no tienen bytes: con ellos se compara
// el tamaño legible (y el nombre)
type Attachment = EmailDraft['attachments'][number];
export const sameAttachment = (a: Attachment, b: Attachment) =>
  a.name === b.name && (a.bytes !== undefined && b.bytes !== undefined ? a.bytes === b.bytes : a.size === b.size);

// Sin estado: guardado (los de antes de 0.9.2)
export const isDraft = (email: Pick<EmailDraft, 'status'>) => email.status === 'draft';

// Cuándo se guardó por última vez, para ordenar y mostrar
export const lastSaved = (email: Pick<EmailDraft, 'updatedAt' | 'sentAt'>) => email.updatedAt ?? email.sentAt;
