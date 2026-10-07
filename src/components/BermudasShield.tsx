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
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-2">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-indigo-600" />
          Contención y Blindaje del Triángulo de las Bermudas Temporal
        </h2>
        <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
          Módulo 5: Neutralización de las tres vías primarias de fuga de tiempo y fragmentación atencional postuladas por el Dr. Jonathan Benito Sipos: <strong>reuniones mal gestionadas</strong>, <strong>correo electrónico reactivo</strong> y <strong>mensajería desestructurada</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* SUBSISTEMA A: GESTIÓN BLINDADA DE REUNIONES */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span>Auditoría de Reuniones (MEETING_GUARD)</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Prohibidas antes de las 12:00 h · Fin estricto · Moderador nominal
              </p>
            </div>

            <button
              onClick={onOpenNewMeeting}
              className="px-3 py-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agendar Reunión Blindada</span>
            </button>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
            <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <strong>Regla de Mañana Profunda:</strong> Cualquier convocatoria entre 08:00 y 11:59 h es bloqueada algorítmicamente para preservar la corteza prefrontal en su momento de máxima agudeza biológica.
            </p>
          </div>

          <div className="space-y-3">
            {meetings.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No hay reuniones programadas.
              </div>
            ) : (
              meetings.map((m) => {
                const start = new Date(m.startTime);
                const end = new Date(m.endTime);
                const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);

                return (
                  <div key={m.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-900">{m.title}</h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold">
                        {durationMin} min (Fin estricto)
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} -{' '}
                        {end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="flex items-center gap-1">
                        <UserCheck className="w-3 h-3 text-indigo-600" />
                        Moderador: <strong>{m.moderatorName}</strong>
                      </span>
                    </div>

                    {m.agendaPoints && m.agendaPoints.length > 0 && (
                      <div className="pt-1.5 border-t border-slate-200/60">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                          Puntos Cerrados del Orden del Día:
                        </span>
                        <ul className="text-xs text-slate-700 space-y-0.5 pl-4 list-disc">
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
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-indigo-600" />
                <span>Mensajería con Redacción Inversa</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Adjuntos → Cuerpo → Alerta No-Scroll → Destinatarios
              </p>
            </div>

            <button
              onClick={onOpenNewEmail}
              className="px-3 py-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Redactar Inversamente</span>
            </button>
          </div>

          <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-950 flex items-start gap-2">
            <Mail className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <strong>Secuencia Contra-Intuitiva:</strong> El campo "Para:" permanece férreamente bloqueado hasta validar que el contenido esté sintetizado y los archivos hayan sido vinculados.
            </p>
          </div>

          <div className="space-y-3">
            {emails.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No hay correos registrados.
              </div>
            ) : (
              emails.map((e) => (
                <div key={e.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-900">{e.subject}</h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(e.sentAt || '').toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {e.body}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {e.attachments.length > 0
                          ? `${e.attachments.length} adjunto(s)`
                          : 'Sin adjuntos declarados'}
                      </span>
                    </div>

                    <div className="text-indigo-700 font-mono text-[10px]">
                      Para: {e.recipients.join(', ')}
                    </div>
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
