import React from 'react';
import { MeetingGuard, EmailDraft } from '../types';
import { ShieldCheck, Calendar, Mail, Clock, UserCheck, Paperclip, Plus, FileText, Trash2 } from 'lucide-react';
import { isDraft, lastSaved } from '../services/email';

interface BermudasShieldProps {
  meetings: MeetingGuard[];
  emails: EmailDraft[];
  onOpenNewMeeting: () => void;
  onOpenNewEmail: () => void;
  // Abrir un correo guardado o seguir con un borrador, y eliminarlo
  onOpenEmail: (email: EmailDraft) => void;
  onDeleteEmail: (email: EmailDraft) => void;
}

const savedFormat = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit'
});

// Un correo de la lista: borrador («Continuar») o guardado («Abrir»), con «Eliminar»
const EmailCard: React.FC<{ email: EmailDraft; onOpen: () => void; onDelete: () => void }> = ({
  email,
  onOpen,
  onDelete
}) => {
  const draft = isDraft(email);
  const title = email.subject.trim() || '(Sin asunto)';
  const saved = lastSaved(email);
  return (
    <li className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/40 p-4">
      <div className="flex items-start justify-between gap-2">
        <h5 className="min-w-0 text-xs font-bold break-words text-slate-900">{title}</h5>
        {saved && (
          <span className="shrink-0 font-mono text-[10px] text-slate-500">{savedFormat.format(new Date(saved))}</span>
        )}
      </div>

      {email.body.trim() && <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">{email.body}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/60 pt-1 text-[11px]">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Paperclip className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          <span>
            {email.attachments.length > 0
              ? `${email.attachments.length} ${email.attachments.length === 1 ? 'adjunto' : 'adjuntos'}`
              : 'Sin adjuntos'}
          </span>
        </div>
        {email.recipients.length > 0 && (
          <div className="font-mono text-[10px] break-all text-indigo-700">Para: {email.recipients.join(', ')}</div>
        )}
      </div>

      <div className="-ml-2 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${draft ? 'Continuar el borrador' : 'Abrir el correo'} «${title}»`}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 hover:text-indigo-900"
        >
          {draft ? 'Continuar' : 'Abrir'}
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Eliminar ${draft ? 'el borrador' : 'el correo'} «${title}»`}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-slate-600 hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Eliminar
        </button>
      </div>
    </li>
  );
};

export const BermudasShield: React.FC<BermudasShieldProps> = ({
  meetings,
  emails,
  onOpenNewMeeting,
  onOpenNewEmail,
  onOpenEmail,
  onDeleteEmail
}) => {
  const drafts = emails.filter(isDraft);
  const saved = emails.filter((e) => !isDraft(e));
  const card = (email: EmailDraft) => (
    <EmailCard key={email.id} email={email} onOpen={() => onOpenEmail(email)} onDelete={() => onDeleteEmail(email)} />
  );
  return (
    <div className="space-y-6">
      {/* Explicación de la contención del Triángulo de las Bermudas */}
      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <ShieldCheck className="h-6 w-6 text-indigo-600" />
          Protege tu tiempo
        </h2>
        <p className="max-w-3xl text-xs leading-relaxed text-slate-600">
          Las tres grandes fugas de tiempo, el «triángulo de las Bermudas»: <strong>reuniones mal planteadas</strong>,{' '}
          <strong>correo reactivo</strong> y <strong>mensajes sin orden</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* SUBSISTEMA A: GESTIÓN BLINDADA DE REUNIONES */}
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Calendar className="h-4 w-4 text-indigo-600" />
                <span>Reuniones</span>
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Después de las 12:00, con hora de fin y alguien que modere
              </p>
            </div>

            <button
              onClick={onOpenNewMeeting}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Planificar una reunión</span>
            </button>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-[11px] leading-relaxed">
              <strong>Mañanas libres:</strong> entre las 8:00 y las 12:00 no se ponen reuniones; es cuando mejor te
              concentras.
            </p>
          </div>

          <div className="space-y-3">
            {meetings.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">No hay reuniones programadas.</div>
            ) : (
              meetings.map((m) => {
                const start = new Date(m.startTime);
                const end = new Date(m.endTime);
                const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);

                return (
                  <div key={m.id} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-900">{m.title}</h4>
                      <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800">
                        {durationMin} min
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-slate-600">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-500" />
                        {start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} -{' '}
                        {end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="flex items-center gap-1">
                        <UserCheck className="h-3 w-3 text-indigo-600" />
                        Moderador: <strong>{m.moderatorName}</strong>
                      </span>
                    </div>

                    {m.agendaPoints && m.agendaPoints.length > 0 && (
                      <div className="border-t border-slate-200/60 pt-1.5">
                        <span className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">
                          Orden del día:
                        </span>
                        <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-700">
                          {m.agendaPoints.map((pt, i) => (
                            <li key={i}>{pt}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* SUBSISTEMA B: CORREO CON REDACCIÓN INVERSA */}
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Mail className="h-4 w-4 text-indigo-600" />
                <span>Correos bien escritos</span>
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500">Primero el contenido, los destinatarios al final</p>
            </div>

            <button
              onClick={onOpenNewEmail}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Escribir un correo</span>
            </button>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-xs text-indigo-950">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
            <p className="text-[11px] leading-relaxed">
              <strong>Al revés de lo habitual:</strong> el destinatario va al final, cuando el correo está listo, para
              no enviarlo antes de tiempo.
            </p>
          </div>

          {drafts.length > 0 && (
            <section aria-labelledby="email-drafts-title" className="space-y-2">
              <h4
                id="email-drafts-title"
                className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-700 uppercase"
              >
                <FileText className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                Borradores ({drafts.length})
              </h4>
              <ul className="space-y-3">{drafts.map(card)}</ul>
            </section>
          )}

          <section aria-labelledby="email-saved-title" className="space-y-2">
            <h4 id="email-saved-title" className="text-xs font-bold tracking-wider text-slate-700 uppercase">
              Guardados ({saved.length})
            </h4>
            {saved.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-500">No hay correos guardados.</p>
            ) : (
              <ul className="space-y-3">{saved.map(card)}</ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
