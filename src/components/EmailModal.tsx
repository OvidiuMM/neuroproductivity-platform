import React, { useRef, useState } from 'react';
import { useModalFocus } from '../hooks/useModalFocus';
import { EmailDraft, EmailStatus } from '../types';
import {
  X,
  Mail,
  Paperclip,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  Send,
  Trash2,
  FileText,
  ExternalLink
} from 'lucide-react';
import {
  EMAIL_BODY_MIN,
  EMAIL_SUBJECT_MIN,
  areValidRecipients,
  buildMailto,
  formatFileSize,
  isDraft,
  parseRecipients
} from '../services/email';

// draft: «Guardar borrador» · auto: al cerrar con cambios sin guardar · saved: correo terminado
export type EmailSaveKind = 'draft' | 'auto' | 'saved';

interface EmailModalProps {
  // Correo que se abre (borrador o guardado), o ninguno para empezar uno nuevo. Se monta al abrirse.
  email?: EmailDraft;
  onClose: () => void;
  onSave: (email: EmailDraft, kind: EmailSaveKind) => void;
}

const stepCheck = (done: boolean, text: string) => (
  <div className="flex items-center gap-1.5">
    {done ? (
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
    ) : (
      <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300" aria-hidden="true" />
    )}
    <span className={done ? 'text-slate-700' : 'text-slate-500'}>{text}</span>
  </div>
);

// En el móvil, un botón por línea, a todo el ancho
const secondaryButton =
  'inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:w-auto';

export const EmailModal: React.FC<EmailModalProps> = ({ email, onClose, onSave }) => {
  // El mismo id para todo lo que se guarde desde esta ventana: los borradores no se duplican
  const [id] = useState(() => email?.id ?? `email-${Date.now()}`);
  const [attachments, setAttachments] = useState(email?.attachments ?? []);
  const [noAttachmentsDeclared, setNoAttachmentsDeclared] = useState(email?.noAttachmentsDeclared ?? false);
  const [body, setBody] = useState(email?.body ?? '');
  const [subject, setSubject] = useState(email?.subject ?? '');
  const [recipientsInput, setRecipientsInput] = useState(email?.recipients.join(', ') ?? '');
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});
  const fileInput = useRef<HTMLInputElement>(null);

  // Cálculo de palabras y caracteres para la regla "No-Scroll"
  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  const isTooLongForNoScroll = wordCount > 100 || body.length > 550;

  // Paso 1: adjuntos (o «Sin archivos adjuntos») · Paso 2: texto · Paso 3: asunto
  const isStep1AttachmentsValid = attachments.length > 0 || noAttachmentsDeclared;
  const isStep2BodyValid = body.trim().length >= EMAIL_BODY_MIN;
  const isStep3SubjectValid = subject.trim().length >= EMAIL_SUBJECT_MIN;

  // DESBLOQUEO DE LOS DESTINATARIOS (redacción inversa): primero los adjuntos y el texto
  const isRecipientsUnlocked = isStep1AttachmentsValid && isStep2BodyValid;
  const parsedRecipients = parseRecipients(recipientsInput);
  const isRecipientsValid = isRecipientsUnlocked && areValidRecipients(parsedRecipients);
  const isFormValid = isStep1AttachmentsValid && isStep2BodyValid && isStep3SubjectValid && isRecipientsValid;

  // Algo escrito o elegido: se puede guardar como borrador o abrir en el programa de correo
  const hasContent = Boolean(subject.trim() || body.trim() || recipientsInput.trim() || attachments.length);
  const snapshot = JSON.stringify([attachments, noAttachmentsDeclared, body, subject, recipientsInput]);
  const [savedSnapshot] = useState(snapshot);
  const isDirty = snapshot !== savedSnapshot;

  const build = (status: EmailStatus): EmailDraft => {
    const now = new Date().toISOString();
    return {
      id,
      userId: email?.userId ?? '',
      subject: status === 'saved' ? subject.trim() : subject,
      body: status === 'saved' ? body.trim() : body,
      attachments,
      noAttachmentsDeclared,
      recipients: parsedRecipients,
      status,
      sentAt: status === 'saved' ? now : email?.sentAt,
      updatedAt: now
    };
  };

  // Cerrar (X, «Cerrar» o Escape) nunca pierde lo escrito: con cambios sin guardar, se guarda como borrador
  const close = () => {
    if (isDirty && hasContent) onSave(build('draft'), 'auto');
    onClose();
  };

  const saveDraft = () => {
    onSave(build('draft'), 'draft');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ body: true, subject: true, recipients: true });
    if (!isFormValid) return;
    onSave(build('saved'), 'saved');
    onClose();
  };

  // Solo el nombre y el tamaño: es la lista de lo que hay que adjuntar al enviarlo, el archivo no sale del equipo
  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = [...(e.target.files ?? [])].map((file) => ({ name: file.name, size: formatFileSize(file.size) }));
    setAttachments((list) => [
      ...list,
      ...picked.filter((file) => !list.some((a) => a.name === file.name && a.size === file.size))
    ]);
    if (picked.length) setNoAttachmentsDeclared(false);
    // Así se puede volver a elegir el mismo archivo después de quitarlo
    e.target.value = '';
  };

  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(true, dialogRef, close);

  const title = !email ? 'Nuevo correo' : isDraft(email) ? 'Continuar el borrador' : 'Editar el correo';

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-xs sm:p-8">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-modal-title"
        className="animate-in fade-in zoom-in-95 my-auto w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl duration-200"
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
          <div>
            <h2 id="email-modal-title" className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Mail className="h-5 w-5 text-indigo-600" aria-hidden="true" />
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Primero el contenido; los destinatarios, al final</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-600"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {/* PASO 1 (INVERSO): ADJUNTOS PRIMERO */}
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-700 uppercase">
                <Paperclip className="h-4 w-4 text-slate-500" aria-hidden="true" />
                Paso 1: Archivos Adjuntos <span className="text-red-500">*</span>
              </span>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={noAttachmentsDeclared}
                  onChange={(e) => {
                    setNoAttachmentsDeclared(e.target.checked);
                    if (e.target.checked) setAttachments([]);
                  }}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
                />
                <span>Sin archivos adjuntos</span>
              </label>
            </div>

            {!noAttachmentsDeclared && (
              <div className="space-y-1.5">
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  hidden
                  onChange={handleFiles}
                  aria-label="Archivos adjuntos"
                />
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  aria-describedby="email-files-help"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 text-xs font-bold text-white transition-colors hover:bg-slate-800"
                >
                  <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                  Elegir archivos
                </button>
                <p id="email-files-help" className="text-[11px] leading-relaxed text-slate-500">
                  CLAR apunta solo el nombre y el tamaño, como lista de lo que adjuntarás al enviarlo desde tu correo:
                  los archivos no salen de tu equipo.
                </p>
              </div>
            )}

            {attachments.length > 0 && (
              <ul aria-label="Archivos que adjuntar" className="space-y-1">
                {attachments.map((att, i) => (
                  <li
                    key={`${att.name}-${i}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs"
                  >
                    <span className="truncate">
                      {att.name} ({att.size})
                    </span>
                    <button
                      type="button"
                      onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}
                      aria-label={`Quitar el adjunto ${att.name}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!isStep1AttachmentsValid && (
              <p className="text-[11px] text-red-600">Elige al menos un archivo o marca «Sin archivos adjuntos».</p>
            )}
          </div>

          {/* PASO 2 (INVERSO): CUERPO DEL CORREO CON ALERTA NO-SCROLL */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="email-body" className="text-xs font-bold tracking-wider text-slate-700 uppercase">
                Paso 2: Cuerpo del Correo <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
                <span>{wordCount} palabras</span>
                <span aria-hidden="true">·</span>
                <span className={body.length > 550 ? 'font-bold text-amber-700' : ''}>{body.length} caracteres</span>
              </div>
            </div>

            <textarea
              id="email-body"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onBlur={() => setTouched({ ...touched, body: true })}
              placeholder="Escribe el mensaje claro y conciso aquí..."
              className={`w-full rounded-xl border px-3.5 py-2.5 text-xs focus:ring-2 focus:outline-none ${
                touched.body && !isStep2BodyValid
                  ? 'border-red-400 bg-red-50/20 focus:ring-red-400'
                  : 'border-slate-300 focus:ring-indigo-400'
              }`}
            />

            {/* ALERTA DE SÍNTESIS INFORMATIVA (NO-SCROLL) */}
            {isTooLongForNoScroll && (
              <div className="mt-1.5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <p className="text-[11px] leading-relaxed">
                  <strong>Es largo:</strong> si cabe en una pantalla, se lee mejor y genera menos idas y vueltas.
                </p>
              </div>
            )}

            {touched.body && !isStep2BodyValid && (
              <p className="mt-1 text-xs text-red-600">
                El cuerpo del correo debe tener al menos {EMAIL_BODY_MIN} caracteres.
              </p>
            )}
          </div>

          {/* PASO 3: ASUNTO SINTÉTICO */}
          <div>
            <label
              htmlFor="email-subject"
              className="mb-1 block text-xs font-bold tracking-wider text-slate-700 uppercase"
            >
              Paso 3: Asunto <span className="text-red-500">*</span>
            </label>
            <input
              id="email-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Asunto claro y descriptivo..."
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            />
          </div>

          {/* PASO 4 (BLOQUEO ESTRICTO): DESTINATARIOS */}
          <div className="rounded-xl border p-3.5 transition-all">
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="email-recipients"
                className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-700 uppercase"
              >
                {isRecipientsUnlocked ? (
                  <Unlock className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                ) : (
                  <Lock className="h-4 w-4 text-slate-500" aria-hidden="true" />
                )}
                <span>Paso 4: Destinatarios</span>
                <span className="text-red-500">*</span>
              </label>

              {!isRecipientsUnlocked ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                  Bloqueado hasta completar contenido
                </span>
              ) : (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 uppercase">
                  Desbloqueado
                </span>
              )}
            </div>

            <input
              id="email-recipients"
              type="text"
              disabled={!isRecipientsUnlocked}
              value={recipientsInput}
              onChange={(e) => setRecipientsInput(e.target.value)}
              onBlur={() => setTouched({ ...touched, recipients: true })}
              placeholder={
                isRecipientsUnlocked
                  ? 'correo1@ejemplo.com, correo2@ejemplo.com'
                  : '🔒 Completa adjuntos y cuerpo para desbloquear este campo'
              }
              className={`w-full rounded-xl border px-3.5 py-2 text-xs focus:ring-2 focus:outline-none ${
                !isRecipientsUnlocked
                  ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500'
                  : touched.recipients && !isRecipientsValid
                    ? 'border-red-400 bg-red-50/20 focus:ring-red-400'
                    : 'border-slate-300 focus:ring-indigo-400'
              }`}
            />

            {isRecipientsUnlocked && touched.recipients && !isRecipientsValid && (
              <p className="mt-1 text-[11px] text-red-600">
                Ingresa al menos una dirección de correo electrónico válida (formato: usuario@dominio.com).
              </p>
            )}
          </div>

          {/* CHECKLIST DE REDACCIÓN INVERSA */}
          <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
            <span className="mb-1 block font-bold text-slate-700">Antes de guardar:</span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {stepCheck(isStep1AttachmentsValid, 'Paso 1: Adjuntos verificados')}
              {stepCheck(isStep2BodyValid, 'Paso 2: Cuerpo redactado')}
              {stepCheck(isStep3SubjectValid, 'Paso 3: Asunto definido')}
              {stepCheck(isRecipientsValid, 'Paso 4: Destinatarios válidos')}
            </div>
          </div>

          {/* BOTONES */}
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="min-h-10 w-full rounded-xl px-3.5 text-xs font-semibold text-slate-600 transition-colors hover:text-slate-900 sm:w-auto"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={saveDraft}
                disabled={!hasContent}
                className={`${secondaryButton} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                Guardar borrador
              </button>
              {hasContent ? (
                <a href={buildMailto({ recipients: parsedRecipients, subject, body })} className={secondaryButton}>
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Abrir en mi correo
                </a>
              ) : (
                <button type="button" disabled className={`${secondaryButton} cursor-not-allowed opacity-50`}>
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Abrir en mi correo
                </button>
              )}
              <button
                type="submit"
                disabled={!isFormValid}
                className={`inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-5 text-xs font-bold shadow-sm transition-all sm:w-auto ${
                  isFormValid
                    ? 'bg-slate-900 text-white hover:bg-slate-800'
                    : 'cursor-not-allowed bg-slate-200 text-slate-500 shadow-none'
                }`}
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                Guardar el correo
              </button>
            </div>
            <p className="text-center text-[11px] text-slate-500 sm:text-right">
              Al cerrar, lo que hayas escrito se guarda como borrador.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
