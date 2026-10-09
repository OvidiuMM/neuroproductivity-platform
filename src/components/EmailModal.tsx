import React, { useState } from 'react';
import { EmailDraft } from '../types';
import { X, Mail, Paperclip, AlertTriangle, CheckCircle2, Lock, Unlock, Send, Plus, Trash2 } from 'lucide-react';

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendEmail: (email: Omit<EmailDraft, 'id'>) => void;
}

export const EmailModal: React.FC<EmailModalProps> = ({
  isOpen,
  onClose,
  onSendEmail
}) => {
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
    isRecipientsUnlocked &&
    parsedRecipients.length > 0 &&
    parsedRecipients.every((email) => emailRegex.test(email));

  // Validación final del formulario completo
  const isFormValid =
    isStep1AttachmentsValid &&
    isStep2BodyValid &&
    isStep3SubjectValid &&
    isRecipientsValid;

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-600" />
              Cliente Asistido con Redacción Inversa
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Protocolo contra re-envíos involuntarios y dispersión atencional
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* PASO 1 (INVERSO): ADJUNTOS PRIMERO */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Paperclip className="w-4 h-4 text-slate-500" />
                Paso 1: Archivos Adjuntos <span className="text-red-500">*</span>
              </span>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={noAttachmentsDeclared}
                  onChange={(e) => {
                    setNoAttachmentsDeclared(e.target.checked);
                    if (e.target.checked) setAttachments([]);
                  }}
                  className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300"
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
                  className="min-w-0 flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
                  className="px-3 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adjuntar</span>
                </button>
              </div>
            )}

            {attachments.length > 0 && (
              <div className="space-y-1">
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center justify-between px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs">
                    <span className="truncate">{att.name} ({att.size})</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(i)}
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Paso 2: Cuerpo del Correo <span className="text-red-500">*</span>
              </label>
              <div className="text-[11px] font-mono flex items-center gap-2 text-slate-500">
                <span>{wordCount} palabras</span>
                <span>·</span>
                <span className={body.length > 550 ? 'text-amber-600 font-bold' : ''}>
                  {body.length} caracteres
                </span>
              </div>
            </div>

            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onBlur={() => setTouched({ ...touched, body: true })}
              placeholder="Escribe el mensaje claro y conciso aquí..."
              className={`w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 ${
                touched.body && !isStep2BodyValid
                  ? 'border-red-400 bg-red-50/20 focus:ring-red-400'
                  : 'border-slate-300 focus:ring-indigo-400'
              }`}
            />

            {/* ALERTA DE SÍNTESIS INFORMATIVA (NO-SCROLL) */}
            {isTooLongForNoScroll && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 mt-1.5 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong>Alerta de Síntesis Informativa:</strong> El cuerpo supera las dimensiones recomendadas sin desplazamiento vertical (no-scroll). La neurociencia de Benito Sipos demuestra que mensajes excesivamente largos fragmentan la atención ajena y multiplican respuestas improductivas.
                </p>
              </div>
            )}

            {touched.body && !isStep2BodyValid && (
              <p className="text-xs text-red-600 mt-1">
                El cuerpo del correo debe tener al menos 15 caracteres.
              </p>
            )}
          </div>

          {/* PASO 3: ASUNTO SINTÉTICO */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Paso 3: Asunto Sintético <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Asunto claro y descriptivo..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* PASO 4 (BLOQUEO ESTRICTO): DESTINATARIOS */}
          <div className="p-3.5 rounded-xl border transition-all">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                {isRecipientsUnlocked ? (
                  <Unlock className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Lock className="w-4 h-4 text-slate-400" />
                )}
                <span>Paso 4: Destinatarios (Desbloqueo Final)</span>
                <span className="text-red-500">*</span>
              </label>

              {!isRecipientsUnlocked ? (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                  Bloqueado hasta completar contenido
                </span>
              ) : (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
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
              className={`w-full px-3.5 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 ${
                !isRecipientsUnlocked
                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  : touched.recipients && !isRecipientsValid
                  ? 'border-red-400 bg-red-50/20 focus:ring-red-400'
                  : 'border-slate-300 focus:ring-indigo-400'
              }`}
            />

            {isRecipientsUnlocked && touched.recipients && !isRecipientsValid && (
              <p className="text-[11px] text-red-600 mt-1">
                Ingresa al menos una dirección de correo electrónico válida (formato: usuario@dominio.com).
              </p>
            )}
          </div>

          {/* CHECKLIST DE REDACCIÓN INVERSA */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
            <span className="font-bold text-slate-700 block mb-1">
              Secuencia Metodológica de Redacción Inversa:
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-1.5">
                {isStep1AttachmentsValid ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" />
                )}
                <span className={isStep1AttachmentsValid ? 'text-slate-700' : 'text-slate-400'}>
                  Paso 1: Adjuntos verificados
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {isStep2BodyValid ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" />
                )}
                <span className={isStep2BodyValid ? 'text-slate-700' : 'text-slate-400'}>
                  Paso 2: Cuerpo redactado
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {isStep3SubjectValid ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" />
                )}
                <span className={isStep3SubjectValid ? 'text-slate-700' : 'text-slate-400'}>
                  Paso 3: Asunto definido
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {isRecipientsValid ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" />
                )}
                <span className={isRecipientsValid ? 'text-slate-700' : 'text-slate-400'}>
                  Paso 4: Destinatarios válidos
                </span>
              </div>
            </div>
          </div>

          {/* BOTONES */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isFormValid}
              className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 ${
                isFormValid
                  ? 'bg-slate-900 text-white hover:bg-slate-800'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>Despachar Mensaje Seguro</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
