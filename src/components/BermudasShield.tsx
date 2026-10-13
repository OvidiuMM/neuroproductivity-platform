import React from 'react';
import { MeetingGuard, EmailDraft } from '../types';
import { ShieldCheck, Calendar, Mail, Clock, UserCheck, AlertTriangle, Paperclip, Send, Plus } from 'lucide-react';

interface BermudasShieldProps {
  meetings: MeetingGuard[];
  emails: EmailDraft[];
  onOpenNewMeeting: () => void;
  onOpenNewEmail: () => void;
}

export const BermudasShield: React.FC<BermudasShieldProps> = ({
  meetings,
  emails,
  onOpenNewMeeting,
  onOpenNewEmail
}) => {
  return (
    <div className="space-y-6">
      {/* Explicación de la contención del Triángulo de las Bermudas */}
      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <ShieldCheck className="h-6 w-6 text-indigo-600" />
          Contención y Blindaje del Triángulo de las Bermudas Temporal
        </h2>
        <p className="max-w-3xl text-xs leading-relaxed text-slate-600">
          Módulo 5: Neutralización de las tres vías primarias de fuga de tiempo y fragmentación atencional:{' '}
          <strong>reuniones mal gestionadas</strong>, <strong>correo electrónico reactivo</strong> y{' '}
          <strong>mensajería desestructurada</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* SUBSISTEMA A: GESTIÓN BLINDADA DE REUNIONES */}
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Calendar className="h-4 w-4 text-indigo-600" />
                <span>Auditoría de Reuniones (MEETING_GUARD)</span>
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Prohibidas antes de las 12:00 h · Fin estricto · Moderador nominal
              </p>
            </div>

            <button
              onClick={onOpenNewMeeting}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Agendar Reunión Blindada</span>
            </button>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-[11px] leading-relaxed">
              <strong>Regla de Mañana Profunda:</strong> Cualquier convocatoria entre 08:00 y 11:59 h es bloqueada
              algorítmicamente para preservar la corteza prefrontal en su momento de máxima agudeza biológica.
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
                        {durationMin} min (Fin estricto)
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
                          Puntos Cerrados del Orden del Día:
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
                <span>Mensajería con Redacción Inversa</span>
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500">Adjuntos → Cuerpo → Alerta No-Scroll → Destinatarios</p>
            </div>

            <button
              onClick={onOpenNewEmail}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Redactar Inversamente</span>
            </button>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-xs text-indigo-950">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
            <p className="text-[11px] leading-relaxed">
              <strong>Secuencia Contra-Intuitiva:</strong> El campo "Para:" permanece férreamente bloqueado hasta
              validar que el contenido esté sintetizado y los archivos hayan sido vinculados.
            </p>
          </div>

          <div className="space-y-3">
            {emails.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">No hay correos registrados.</div>
            ) : (
              emails.map((e) => (
                <div key={e.id} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-900">{e.subject}</h4>
                    <span className="font-mono text-[10px] text-slate-500">
                      {new Date(e.sentAt || '').toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">{e.body}</p>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/60 pt-1 text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Paperclip className="h-3.5 w-3.5 text-slate-500" />
                      <span>
                        {e.attachments.length > 0 ? `${e.attachments.length} adjunto(s)` : 'Sin adjuntos declarados'}
                      </span>
                    </div>

                    <div className="font-mono text-[10px] text-indigo-700">Para: {e.recipients.join(', ')}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
