import React, { useState } from 'react';
import { MeetingGuard } from '../types';
import { X, Calendar, Clock, ShieldAlert, CheckCircle2, AlertTriangle, Plus, Trash2, Check } from 'lucide-react';

interface MeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveMeeting: (meeting: Omit<MeetingGuard, 'id' | 'createdAt'>) => void;
}

export const MeetingModal: React.FC<MeetingModalProps> = ({
  isOpen,
  onClose,
  onSaveMeeting
}) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('13:00'); // Hora valle por defecto
  const [endTime, setEndTime] = useState('13:45');
  const [agendaInput, setAgendaInput] = useState('');
  const [agendaPoints, setAgendaPoints] = useState<string[]>([
    'Revisión de avances del Top 10 operativo',
    'Bloqueos técnicos y asignación de responsables'
  ]);
  const [moderatorName, setModeratorName] = useState('');
  const [moderatorEmail, setModeratorEmail] = useState('');
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});

  // Regla 1: Auditoría Heurística de Mañana Profunda (Antes de las 12:00 h)
  const startHour = parseInt(startTime.split(':')[0], 10) || 0;
  const isMorningMeeting = startHour < 12;

  // Regla 2: Hora de fin estrictamente posterior a hora de inicio
  const isTimeOrderValid = (() => {
    if (!startTime || !endTime) return false;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    return eh * 60 + em > sh * 60 + sm;
  })();

  // Regla 3: Agenda cerrada no vacía (mínimo 1 punto)
  const isAgendaValid = agendaPoints.length > 0;

  // Regla 4: Moderador nominal obligatorio
  const isModeratorValid = moderatorName.trim().length > 0;

  // Regla 5: Título obligatorio
  const isTitleValid = title.trim().length > 0 && title.length <= 100;

  // Validación consolidada global (Innegociable en persistencia)
  const isFormValid =
    isTitleValid &&
    !isMorningMeeting &&
    isTimeOrderValid &&
    isAgendaValid &&
    isModeratorValid;

  const handleAddAgendaPoint = () => {
    if (!agendaInput.trim()) return;
    setAgendaPoints([...agendaPoints, agendaInput.trim()]);
    setAgendaInput('');
  };

  const handleRemoveAgendaPoint = (idx: number) => {
    setAgendaPoints(agendaPoints.filter((_, i) => i !== idx));
  };

  const relocateToValleyHour = () => {
    setStartTime('13:00');
    setEndTime('13:45');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ title: true, moderator: true });

    if (!isFormValid) return;

    const startDateTime = new Date(`${date}T${startTime}:00`).toISOString();
    const endDateTime = new Date(`${date}T${endTime}:00`).toISOString();

    onSaveMeeting({
      userId: 'user-default',
      title: title.trim(),
      startTime: startDateTime,
      endTime: endDateTime,
      agendaPoints,
      moderatorName: moderatorName.trim(),
      moderatorEmail: moderatorEmail.trim()
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
              <Calendar className="w-5 h-5 text-indigo-600" />
              Blindaje de Reunión (Triángulo de las Bermudas)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Triple validación innegociable contra la fragmentación atencional
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

          {/* TÍTULO */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Título de la Convocatoria <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">{title.length}/100</span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setTouched({ ...touched, title: true })}
              placeholder="ej. Sincronización técnica de sprint y cuellos de botella"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                touched.title && !isTitleValid
                  ? 'border-red-400 bg-red-50/20 focus:ring-red-400'
                  : 'border-slate-300 focus:ring-indigo-400'
              }`}
            />
            {touched.title && !isTitleValid && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> El título es obligatorio y no puede superar 100 caracteres.
              </p>
            )}
          </div>

          {/* HORARIOS: AUDITORÍA MATUTINA & END_TIME > START_TIME */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Fecha
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Inicio <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 ${
                    isMorningMeeting
                      ? 'border-red-400 bg-red-50/30 text-red-900 focus:ring-red-400'
                      : 'border-slate-300 focus:ring-indigo-400'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Fin Estricto <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 ${
                  !isTimeOrderValid
                    ? 'border-red-400 bg-red-50/30 text-red-900 focus:ring-red-400'
                    : 'border-slate-300 focus:ring-indigo-400'
                }`}
              />
            </div>
          </div>

          {/* ALERTA DE BLOQUEO HEURÍSTICO MATUTINO (< 12:00 h) */}
          {isMorningMeeting && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1.5 flex-1">
                  <p className="font-bold text-red-800">
                    Bloqueo Heurístico: Franja de Concentración Profunda Matutina
                  </p>
                  <p className="text-red-700 leading-relaxed text-[11px]">
                    La neurociencia del Dr. Benito Sipos proscribe celebrar reuniones antes de las 12:00 h. Las mañanas deben reservarse para el trabajo reflexivo de alto valor biológico.
                  </p>
                  <button
                    type="button"
                    onClick={relocateToValleyHour}
                    className="mt-1 px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Reubicar algorítmicamente a las 13:00 h (Hora Valle)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ALERTA ORDEN DE HORA INVÁLIDO */}
          {!isTimeOrderValid && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> La hora de fin debe ser posterior a la hora de inicio (Ley de Parkinson).
            </p>
          )}

          {/* AGENDA CERRADA OBLIGATORIA */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Orden del Día Cerrado (Obligatorio) <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={agendaInput}
                onChange={(e) => setAgendaInput(e.target.value)}
                placeholder="Punto concreto que se va a tratar..."
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAgendaPoint();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddAgendaPoint}
                className="px-3 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar</span>
              </button>
            </div>

            {agendaPoints.length === 0 ? (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Debe especificarse al menos un punto en el orden del día.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                {agendaPoints.map((pt, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-slate-100 rounded-lg text-xs text-slate-800">
                    <span>{i + 1}. {pt}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAgendaPoint(i)}
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DESIGNACIÓN NOMINAL OBLIGATORIA DE MODERADOR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Moderador Responsable <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={moderatorName}
                onChange={(e) => setModeratorName(e.target.value)}
                onBlur={() => setTouched({ ...touched, moderator: true })}
                placeholder="Nombre del moderador nominal"
                className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 ${
                  touched.moderator && !isModeratorValid
                    ? 'border-red-400 bg-red-50/20 focus:ring-red-400'
                    : 'border-slate-300 focus:ring-indigo-400'
                }`}
              />
              {touched.moderator && !isModeratorValid && (
                <p className="text-[11px] text-red-600 mt-1">Designación nominal requerida.</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Email del Moderador
              </label>
              <input
                type="email"
                value={moderatorEmail}
                onChange={(e) => setModeratorEmail(e.target.value)}
                placeholder="moderador@organizacion.com"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          {/* CHECKLIST DE TRIPLE VALIDACIÓN EN VIVO */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
            <span className="font-bold text-slate-700 block mb-1">
              Cumplimiento de Blindaje Triángulo de las Bermudas:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-1.5">
                {!isMorningMeeting && isTimeOrderValid ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" />
                )}
                <span className={!isMorningMeeting ? 'text-slate-700' : 'text-slate-400'}>
                  Horario valle (≥ 12:00 h) y fin estricto
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {isAgendaValid ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" />
                )}
                <span className={isAgendaValid ? 'text-slate-700' : 'text-slate-400'}>
                  Orden del día cerrado no vacío
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {isModeratorValid ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" />
                )}
                <span className={isModeratorValid ? 'text-slate-700' : 'text-slate-400'}>
                  Moderador nominal responsable
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {isTitleValid ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" />
                )}
                <span className={isTitleValid ? 'text-slate-700' : 'text-slate-400'}>
                  Título ≤ 100 caracteres
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
              <Check className="w-4 h-4" />
              <span>Guardar Convocatoria Blindada</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
