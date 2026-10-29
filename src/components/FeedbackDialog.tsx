import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, MessageSquare, X } from 'lucide-react';
import { FirebaseError } from 'firebase/app';
import type { Functions } from 'firebase/functions';
import { useModalFocus } from '../hooks/useModalFocus';
import {
  FEEDBACK_DESCRIPTION_MAX,
  FEEDBACK_SUBJECT_MAX,
  FEEDBACK_TYPES,
  describeDevice,
  deviceLabel,
  type FeedbackType
} from '../services/feedback';
import { submitFeedback } from '../services/feedbackApi';
import { messages } from '../i18n/locale';

interface FeedbackDialogProps {
  functions: Functions;
  onClose: () => void;
  // Adónde vuelve el foco si el botón que la abrió ya no está (p. ej. dentro de un menú que se cerró)
  returnFocusTo?: () => HTMLElement | null;
}

const SEND_ERRORS: Record<string, string> = messages(
  {
    'functions/resource-exhausted': 'Has enviado varios mensajes seguidos. Inténtalo de nuevo en un rato.',
    'functions/permission-denied': 'Confirma tu email para poder escribirnos.',
    'functions/invalid-argument': 'Revisa el tipo, el asunto y la descripción.'
  },
  {
    'functions/resource-exhausted': "You've sent several messages in a row. Try again in a while.",
    'functions/permission-denied': 'Confirm your email to be able to contact us.',
    'functions/invalid-argument': 'Check the type, the subject and the description.'
  }
);

const m = messages(
  {
    sendFailed: 'No se pudo enviar. Comprueba la conexión e inténtalo de nuevo.',
    rows: {
      version: 'Versión de CLAR',
      os: 'Sistema',
      browser: 'Navegador',
      device: 'Dispositivo',
      language: 'Idioma',
      connection: 'Conexión'
    },
    online: 'Con conexión',
    offline: 'Sin conexión',
    title: 'Escríbenos',
    close: 'Cerrar',
    thanks: '¡Gracias! Hemos recibido tu mensaje.',
    willReply: 'Si hace falta, te responderemos a tu email.',
    intro: 'Una idea, un fallo o cualquier cosa que quieras contarnos. Te responderemos a tu email.',
    type: 'Tipo de mensaje',
    subject: 'Asunto',
    description: 'Descripción',
    characters: (length: number) => `${length}/${FEEDBACK_DESCRIPTION_MAX} caracteres`,
    attach: 'Adjuntar información técnica',
    attachHelp:
      'Solo lo que ves aquí, sin el identificador completo del navegador. Se guarda con tu mensaje y nos ayuda a reproducir un fallo.',
    privacy:
      'Para responderte guardamos el mensaje con tu nombre y tu email. Si eliminas tu cuenta, tus mensajes se borran con ella.',
    cancel: 'Cancelar',
    sending: 'Enviando…',
    send: 'Enviar'
  },
  {
    sendFailed: "Couldn't send it. Check your connection and try again.",
    rows: {
      version: 'CLAR version',
      os: 'System',
      browser: 'Browser',
      device: 'Device',
      language: 'Language',
      connection: 'Connection'
    },
    online: 'Online',
    offline: 'Offline',
    title: 'Contact us',
    close: 'Close',
    thanks: "Thank you! We've received your message.",
    willReply: "If needed, we'll reply to your email.",
    intro: "An idea, a bug or anything you'd like to tell us. We'll reply to your email.",
    type: 'Message type',
    subject: 'Subject',
    description: 'Description',
    characters: (length) => `${length}/${FEEDBACK_DESCRIPTION_MAX} characters`,
    attach: 'Attach technical information',
    attachHelp:
      "Only what you see here, without your browser's full identifier. It's saved with your message and helps us reproduce a bug.",
    privacy:
      'To reply to you, we save your message with your name and email. If you delete your account, your messages are deleted with it.',
    cancel: 'Cancel',
    sending: 'Sending…',
    send: 'Send'
  }
);

const inputClass =
  'w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none';
const labelClass = 'mb-1.5 block text-xs font-bold tracking-wider text-slate-600 uppercase';

// Contacto: sugerencias, errores o cualquier mensaje. La información técnica es opcional y se ve antes de enviarla.
export const FeedbackDialog: React.FC<FeedbackDialogProps> = ({ functions, onClose, returnFocusTo }) => {
  const [type, setType] = useState<FeedbackType>('suggestion');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [attachContext, setAttachContext] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [context] = useState(() => describeDevice(__APP_VERSION__));

  const dialogRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  useModalFocus(true, dialogRef, onClose, returnFocusTo);
  // Enviado: el foco pasa al mensaje de confirmación
  useEffect(() => {
    if (sent) doneRef.current?.focus();
  }, [sent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await submitFeedback(functions, {
        type,
        subject: subject.trim(),
        description: description.trim(),
        ...(attachContext ? { context } : {})
      });
      setSent(true);
    } catch (err) {
      setError((err instanceof FirebaseError && SEND_ERRORS[err.code]) || m.sendFailed);
    } finally {
      setBusy(false);
    }
  };

  const contextRows: [string, string][] = [
    [m.rows.version, context.appVersion],
    [m.rows.os, context.os],
    [m.rows.browser, context.browser],
    [m.rows.device, deviceLabel(context.deviceClass)],
    [m.rows.language, context.language],
    [m.rows.connection, context.online ? m.online : m.offline]
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-xs sm:p-8">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        className="animate-in fade-in zoom-in-95 my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl duration-200"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
          <h2 id="feedback-title" className="flex items-center gap-2 text-base font-bold text-slate-900">
            <MessageSquare className="h-5 w-5 text-indigo-600" aria-hidden="true" />
            {m.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={m.close}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-600"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {sent ? (
          <div className="space-y-4 p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden="true" />
            <h3 ref={doneRef} tabIndex={-1} className="text-base font-bold text-slate-900 focus:outline-none">
              {m.thanks}
            </h3>
            <p className="text-sm text-slate-600">{m.willReply}</p>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white hover:bg-slate-800"
            >
              {m.close}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 p-6">
            <p className="text-xs leading-relaxed text-slate-600">{m.intro}</p>

            <fieldset>
              <legend className={labelClass}>{m.type}</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {FEEDBACK_TYPES.map((option) => (
                  <label
                    key={option.value}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${
                      type === option.value
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-900'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="feedback-type"
                      value={option.value}
                      checked={type === option.value}
                      onChange={() => setType(option.value)}
                      className="h-4 w-4 text-indigo-600"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="feedback-subject" className={labelClass}>
                {m.subject}
              </label>
              <input
                id="feedback-subject"
                type="text"
                required
                maxLength={FEEDBACK_SUBJECT_MAX}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={inputClass}
                data-autofocus
              />
            </div>

            <div>
              <label htmlFor="feedback-description" className={labelClass}>
                {m.description}
              </label>
              <textarea
                id="feedback-description"
                required
                rows={5}
                maxLength={FEEDBACK_DESCRIPTION_MAX}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                aria-describedby="feedback-description-count"
                className={inputClass}
              />
              <p id="feedback-description-count" className="mt-1 text-right text-[11px] text-slate-500">
                {m.characters(description.length)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={attachContext}
                  onChange={(e) => setAttachContext(e.target.checked)}
                  aria-controls="feedback-context"
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
                <span className="text-xs text-slate-700">
                  <span className="block font-bold text-slate-800">{m.attach}</span>
                  {m.attachHelp}
                </span>
              </label>
              {/* Siempre en la página (lo controla la casilla con aria-controls), oculta hasta marcarla */}
              {
                <dl
                  id="feedback-context"
                  hidden={!attachContext}
                  className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs"
                >
                  {contextRows.map(([label, value]) => (
                    <React.Fragment key={label}>
                      <dt className="text-slate-600">{label}</dt>
                      <dd className="font-semibold text-slate-900">{value}</dd>
                    </React.Fragment>
                  ))}
                </dl>
              }
            </div>

            {error && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {error}
              </p>
            )}

            <p className="text-[11px] leading-relaxed text-slate-600">{m.privacy}</p>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                {m.cancel}
              </button>
              <button
                type="submit"
                disabled={busy}
                className="min-h-11 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {busy ? m.sending : m.send}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
