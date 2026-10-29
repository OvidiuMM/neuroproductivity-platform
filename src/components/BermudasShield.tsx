import React from 'react';
import { MeetingGuard, EmailDraft } from '../types';
import { ShieldCheck, Calendar, Mail, Clock, UserCheck, Paperclip, Plus, FileText, Trash2 } from 'lucide-react';
import { isDraft, lastSaved } from '../services/email';
import { LOCALE_TAG, messages } from '../i18n/locale';

interface BermudasShieldProps {
  meetings: MeetingGuard[];
  emails: EmailDraft[];
  onOpenNewMeeting: () => void;
  onOpenNewEmail: () => void;
  // Abrir un correo guardado o seguir con un borrador, y eliminarlo
  onOpenEmail: (email: EmailDraft) => void;
  onDeleteEmail: (email: EmailDraft) => void;
}

const savedFormat = new Intl.DateTimeFormat(LOCALE_TAG, {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit'
});

const timeFormat = new Intl.DateTimeFormat(LOCALE_TAG, { hour: '2-digit', minute: '2-digit' });

const m = messages(
  {
    noSubject: '(Sin asunto)',
    attachments: (n: number) => `${n} ${n === 1 ? 'adjunto' : 'adjuntos'}`,
    noAttachments: 'Sin adjuntos',
    to: (recipients: string) => `Para: ${recipients}`,
    openLabel: (draft: boolean, title: string) => `${draft ? 'Continuar el borrador' : 'Abrir el correo'} «${title}»`,
    continue: 'Continuar',
    open: 'Abrir',
    deleteLabel: (draft: boolean, title: string) => `Eliminar ${draft ? 'el borrador' : 'el correo'} «${title}»`,
    delete: 'Eliminar',
    protect: 'Protege tu tiempo',
    leaks: (
      <>
        Las tres grandes fugas de tiempo, el «triángulo de las Bermudas»: <strong>reuniones mal planteadas</strong>,{' '}
        <strong>correo reactivo</strong> y <strong>mensajes sin orden</strong>. Aquí tienes herramientas para las dos
        primeras.
      </>
    ),
    meetings: 'Reuniones',
    meetingsRule: 'Después de las 12:00, con hora de fin y alguien que modere',
    planMeeting: 'Planificar una reunión',
    freeMornings: 'Mañanas libres:',
    freeMorningsText: ' antes de las 12:00 no se ponen reuniones; es cuando mejor te concentras.',
    noMeetings: 'No hay reuniones programadas.',
    minutes: (n: number) => `${n} min`,
    moderator: 'Moderador:',
    agenda: 'Orden del día:',
    emails: 'Correos bien escritos',
    emailsRule: 'Primero el contenido, los destinatarios al final',
    writeEmail: 'Escribir un correo',
    reverse: 'Al revés de lo habitual:',
    reverseText:
      ' el destinatario va al final, cuando el correo está listo, para no enviarlo antes de tiempo. CLAR no lo envía: lo guarda (también a medias, como borrador) y «Abrir en mi correo» lo pasa a tu programa de correo.',
    drafts: (n: number) => `Borradores (${n})`,
    saved: (n: number) => `Guardados (${n})`,
    noSaved: 'No hay correos guardados.'
  },
  {
    noSubject: '(No subject)',
    attachments: (n) => `${n} ${n === 1 ? 'attachment' : 'attachments'}`,
    noAttachments: 'No attachments',
    to: (recipients) => `To: ${recipients}`,
    openLabel: (draft, title) => `${draft ? 'Continue the draft' : 'Open the email'} “${title}”`,
    continue: 'Continue',
    open: 'Open',
    deleteLabel: (draft, title) => `Delete the ${draft ? 'draft' : 'email'} “${title}”`,
    delete: 'Delete',
    protect: 'Protect your time',
    leaks: (
      <>
        The three big time drains, the “Bermuda Triangle”: <strong>poorly planned meetings</strong>,{' '}
        <strong>reactive email</strong> and <strong>scattered messages</strong>. Here are tools for the first two.
      </>
    ),
    meetings: 'Meetings',
    meetingsRule: 'After 12:00, with an end time and someone to moderate',
    planMeeting: 'Plan a meeting',
    freeMornings: 'Free mornings:',
    freeMorningsText: ' no meetings before 12:00; that’s when you focus best.',
    noMeetings: 'No meetings scheduled.',
    minutes: (n) => `${n} min`,
    moderator: 'Moderator:',
    agenda: 'Agenda:',
    emails: 'Well-written emails',
    emailsRule: 'Content first, recipients last',
    writeEmail: 'Write an email',
    reverse: 'The other way around:',
    reverseText:
      ' the recipient goes last, when the email is ready, so you don’t send it too soon. CLAR doesn’t send it: it saves it (half-written too, as a draft), and “Open in my email” passes it to your email app.',
    drafts: (n) => `Drafts (${n})`,
    saved: (n) => `Saved (${n})`,
    noSaved: 'No saved emails.'
  }
);

// Un correo de la lista: borrador («Continuar») o guardado («Abrir»), con «Eliminar»
const EmailCard: React.FC<{ email: EmailDraft; onOpen: () => void; onDelete: () => void }> = ({
  email,
  onOpen,
  onDelete
}) => {
  const draft = isDraft(email);
  const title = email.subject.trim() || m.noSubject;
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
          <span>{email.attachments.length > 0 ? m.attachments(email.attachments.length) : m.noAttachments}</span>
        </div>
        {email.recipients.length > 0 && (
          <div className="font-mono text-[10px] break-all text-indigo-700">{m.to(email.recipients.join(', '))}</div>
        )}
      </div>

      <div className="-ml-2 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={onOpen}
          aria-label={m.openLabel(draft, title)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 hover:text-indigo-900"
        >
          {draft ? m.continue : m.open}
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={m.deleteLabel(draft, title)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-slate-600 hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          {m.delete}
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
          {m.protect}
        </h2>
        <p className="max-w-3xl text-xs leading-relaxed text-slate-600">{m.leaks}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* SUBSISTEMA A: GESTIÓN BLINDADA DE REUNIONES */}
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Calendar className="h-4 w-4 text-indigo-600" />
                <span>{m.meetings}</span>
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500">{m.meetingsRule}</p>
            </div>

            <button
              onClick={onOpenNewMeeting}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{m.planMeeting}</span>
            </button>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-[11px] leading-relaxed">
              <strong>{m.freeMornings}</strong>
              {m.freeMorningsText}
            </p>
          </div>

          <div className="space-y-3">
            {meetings.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">{m.noMeetings}</div>
            ) : (
              meetings.map((meeting) => {
                const start = new Date(meeting.startTime);
                const end = new Date(meeting.endTime);
                const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);

                return (
                  <div key={meeting.id} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-900">{meeting.title}</h4>
                      <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800">
                        {m.minutes(durationMin)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-slate-600">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-500" />
                        {timeFormat.format(start)} - {timeFormat.format(end)}
                      </span>
                      <span className="flex items-center gap-1">
                        <UserCheck className="h-3 w-3 text-indigo-600" />
                        {m.moderator} <strong>{meeting.moderatorName}</strong>
                      </span>
                    </div>

                    {meeting.agendaPoints && meeting.agendaPoints.length > 0 && (
                      <div className="border-t border-slate-200/60 pt-1.5">
                        <span className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">{m.agenda}</span>
                        <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-700">
                          {meeting.agendaPoints.map((pt, i) => (
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
                <span>{m.emails}</span>
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500">{m.emailsRule}</p>
            </div>

            <button
              onClick={onOpenNewEmail}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{m.writeEmail}</span>
            </button>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-xs text-indigo-950">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
            <p className="text-[11px] leading-relaxed">
              <strong>{m.reverse}</strong>
              {m.reverseText}
            </p>
          </div>

          {drafts.length > 0 && (
            <section aria-labelledby="email-drafts-title" className="space-y-2">
              <h4
                id="email-drafts-title"
                className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-700 uppercase"
              >
                <FileText className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                {m.drafts(drafts.length)}
              </h4>
              <ul className="space-y-3">{drafts.map(card)}</ul>
            </section>
          )}

          <section aria-labelledby="email-saved-title" className="space-y-2">
            <h4 id="email-saved-title" className="text-xs font-bold tracking-wider text-slate-700 uppercase">
              {m.saved(saved.length)}
            </h4>
            {saved.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-500">{m.noSaved}</p>
            ) : (
              <ul className="space-y-3">{saved.map(card)}</ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
