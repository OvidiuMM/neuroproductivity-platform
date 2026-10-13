import React, { useRef, useState } from 'react';
import { useModalFocus } from '../hooks/useModalFocus';
import { EmailDraft } from '../types';
import { X, Mail, Paperclip, AlertTriangle, CheckCircle2, Lock, Unlock, Send, Plus, Trash2 } from 'lucide-react';

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendEmail: (email: Omit<EmailDraft, 'id'>) => void;
}

export const EmailModal: React.FC<EmailModalProps> = ({ isOpen, onClose, onSendEmail }) => {
  const [attachments, setAttachments] = useState<{ name: string; size: string }[]>([]);
  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [noAttachmentsDeclared, setNoAttachmentsDeclared] = useState(false);
  const [body, setBody] = useState('');
  const [subject, setSubject] = useState('');
  const [recipientsInput, setRecipientsInput] = useState('');
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});

  // Cálculo de palabras y caracteres para la regla "No-Scroll"
  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  const isTooLongForNoScroll = wordCount > 100 || body.length > 550;

  // Paso 1: Validación de Adjuntos
  const isStep1AttachmentsValid = attachments.length > 0 || noAttachmentsDeclared;

  // Paso 2: Validación de Cuerpo
  const isStep2BodyValid = body.trim().length > 15;

  // Paso 3: Validación de Asunto
  const isStep3SubjectValid = subject.trim().length > 3;

  // DESBLOQUEO DEL CAMPO DE DESTINATARIOS (Redacción Inversa)
  // El usuario DEBE adjuntar y redactar el cuerpo antes de que los destinatarios se desbloqueen
  const isRecipientsUnlocked = isStep1AttachmentsValid && isStep2BodyValid;

  // Paso 4: Validación de Destinatarios
  const parsedRecipients = recipientsInput
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isRecipientsValid =
    isRecipientsUnlocked && parsedRecipients.length > 0 && parsedRecipients.every((email) => emailRegex.test(email));

  // Validación final del formulario completo
  const isFormValid = isStep1AttachmentsValid && isStep2BodyValid && isStep3SubjectValid && isRecipientsValid;

  const handleAddAttachment = () => {
    if (!newAttachmentName.trim()) return;
    setAttachments([...attachments, { name: newAttachmentName.trim(), size: '1.2 MB' }]);
    setNewAttachmentName('');
    setNoAttachmentsDeclared(false);
  };

  const handleRemoveAttachment = (idx: number) => {
    setAttachments(attachments.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ body: true, subject: true, recipients: true });

    if (!isFormValid) return;

    onSendEmail({
      userId: 'user-default',
      subject: subject.trim(),
      body: body.trim(),
      attachments,
      noAttachmentsDeclared,
      recipients: parsedRecipients,
      sentAt: new Date().toISOString()
    });

    onClose();
  };

  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(isOpen, dialogRef, onClose);

  if (!isOpen) return null;

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
              <Mail className="h-5 w-5 text-indigo-600" />
              Cliente Asistido con Redacción Inversa
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Protocolo contra re-envíos involuntarios y dispersión atencional
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {/* PASO 1 (INVERSO): ADJUNTOS PRIMERO */}
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-700 uppercase">
                <Paperclip className="h-4 w-4 text-slate-500" />
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
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAttachmentName}
                  onChange={(e) => setNewAttachmentName(e.target.value)}
                  placeholder="Nombre de archivo (ej. balance_trimestral.xlsx)..."
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddAttachment();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddAttachment}
                  className="flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-slate-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Adjuntar</span>
                </button>
              </div>
            )}

            {attachments.length > 0 && (
              <div className="space-y-1">
                {attachments.map((att, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs"
                  >
                    <span className="truncate">
                      {att.name} ({att.size})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(i)}
                      aria-label={`Quitar el adjunto ${att.name}`}
                      className="text-slate-500 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!isStep1AttachmentsValid && (
              <p className="text-[11px] text-red-600">
                Debe adjuntar al menos un archivo o marcar "Sin archivos adjuntos".
              </p>
            )}
          </div>

          {/* PASO 2 (INVERSO): CUERPO DEL CORREO CON ALERTA NO-SCROLL */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-bold tracking-wider text-slate-700 uppercase">
                Paso 2: Cuerpo del Correo <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
                <span>{wordCount} palabras</span>
                <span>·</span>
                <span className={body.length > 550 ? 'font-bold text-amber-700' : ''}>{body.length} caracteres</span>
              </div>
            </div>

            <textarea
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
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-[11px] leading-relaxed">
                  <strong>Alerta de Síntesis Informativa:</strong> El cuerpo supera las dimensiones recomendadas sin
                  desplazamiento vertical (no-scroll). Los mensajes largos fragmentan la atención de quien los lee y
                  suelen generar más idas y vueltas.
                </p>
              </div>
            )}

            {touched.body && !isStep2BodyValid && (
              <p className="mt-1 text-xs text-red-600">El cuerpo del correo debe tener al menos 15 caracteres.</p>
            )}
          </div>

          {/* PASO 3: ASUNTO SINTÉTICO */}
          <div>
            <label className="mb-1 block text-xs font-bold tracking-wider text-slate-700 uppercase">
              Paso 3: Asunto Sintético <span className="text-red-500">*</span>
            </label>
            <input
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
              <label className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-700 uppercase">
                {isRecipientsUnlocked ? (
                  <Unlock className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Lock className="h-4 w-4 text-slate-500" />
                )}
                <span>Paso 4: Destinatarios (Desbloqueo Final)</span>
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
            <span className="mb-1 block font-bold text-slate-700">Secuencia Metodológica de Redacción Inversa:</span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-1.5">
                {isStep1AttachmentsValid ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                ) : (
                  <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300" />
                )}
                <span className={isStep1AttachmentsValid ? 'text-slate-700' : 'text-slate-500'}>
                  Paso 1: Adjuntos verificados
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {isStep2BodyValid ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                ) : (
                  <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300" />
                )}
                <span className={isStep2BodyValid ? 'text-slate-700' : 'text-slate-500'}>Paso 2: Cuerpo redactado</span>
              </div>

              <div className="flex items-center gap-1.5">
                {isStep3SubjectValid ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                ) : (
                  <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300" />
                )}
                <span className={isStep3SubjectValid ? 'text-slate-700' : 'text-slate-500'}>
                  Paso 3: Asunto definido
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {isRecipientsValid ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                ) : (
                  <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300" />
                )}
                <span className={isRecipientsValid ? 'text-slate-700' : 'text-slate-500'}>
                  Paso 4: Destinatarios válidos
                </span>
              </div>
            </div>
          </div>

          {/* BOTONES */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:text-slate-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isFormValid}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold shadow-sm transition-all ${
                isFormValid
                  ? 'bg-slate-900 text-white hover:bg-slate-800'
                  : 'cursor-not-allowed bg-slate-200 text-slate-500 shadow-none'
              }`}
            >
              <Send className="h-4 w-4" />
              <span>Despachar Mensaje Seguro</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
