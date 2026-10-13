import React, { useRef, useState } from 'react';
import { useModalFocus } from '../hooks/useModalFocus';
import { MeetingGuard } from '../types';
import { X, Calendar, Clock, ShieldAlert, CheckCircle2, AlertTriangle, Plus, Trash2, Check } from 'lucide-react';
import { DateField } from './DateField';

interface MeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveMeeting: (meeting: Omit<MeetingGuard, 'id' | 'createdAt'>) => void;
}

export const MeetingModal: React.FC<MeetingModalProps> = ({ isOpen, onClose, onSaveMeeting }) => {
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

  // Regla 6: fecha obligatoria (el calendario permite borrarla)
  const isDateValid = /^\d{4}-\d{2}-\d{2}$/.test(date);

  // Validación consolidada global (Innegociable en persistencia)
  const isFormValid =
    isTitleValid && isDateValid && !isMorningMeeting && isTimeOrderValid && isAgendaValid && isModeratorValid;

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

  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(isOpen, dialogRef, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-xs sm:p-8">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="meeting-modal-title"
        className="animate-in fade-in zoom-in-95 my-auto w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl duration-200"
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
          <div>
            <h2 id="meeting-modal-title" className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Calendar className="h-5 w-5 text-indigo-600" />
              Blindaje de Reunión (Triángulo de las Bermudas)
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Triple validación innegociable contra la fragmentación atencional
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
          {/* TÍTULO */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="meeting-title" className="text-xs font-bold tracking-wider text-slate-600 uppercase">
                Título de la Convocatoria <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-slate-500">{title.length}/100</span>
            </div>
            <input
              id="meeting-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setTouched({ ...touched, title: true })}
              placeholder="ej. Sincronización técnica de sprint y cuellos de botella"
              className={`w-full rounded-xl border px-3.5 py-2.5 text-sm focus:ring-2 focus:outline-none ${
                touched.title && !isTitleValid
                  ? 'border-red-400 bg-red-50/20 focus:ring-red-400'
                  : 'border-slate-300 focus:ring-indigo-400'
              }`}
            />
            {touched.title && !isTitleValid && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                <AlertTriangle className="h-3.5 w-3.5" /> El título es obligatorio y no puede superar 100 caracteres.
              </p>
            )}
          </div>

          {/* HORARIOS: AUDITORÍA MATUTINA & END_TIME > START_TIME */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label
                htmlFor="meeting-date"
                className="mb-1 block text-xs font-bold tracking-wider text-slate-600 uppercase"
              >
                Fecha
              </label>
              <DateField
                id="meeting-date"
                label="Fecha de la reunión"
                hasVisibleLabel
                required
                value={date}
                onChange={setDate}
                inputClassName="px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              {!isDateValid && (
                <p role="alert" className="mt-1 text-xs text-red-600">
                  La reunión necesita una fecha.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="meeting-start"
                className="mb-1 block text-xs font-bold tracking-wider text-slate-600 uppercase"
              >
                Inicio <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="meeting-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2 text-xs focus:ring-2 focus:outline-none ${
                    isMorningMeeting
                      ? 'border-red-400 bg-red-50/30 text-red-900 focus:ring-red-400'
                      : 'border-slate-300 focus:ring-indigo-400'
                  }`}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="meeting-end"
                className="mb-1 block text-xs font-bold tracking-wider text-slate-600 uppercase"
              >
                Fin Estricto <span className="text-red-500">*</span>
              </label>
              <input
                id="meeting-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-xs focus:ring-2 focus:outline-none ${
                  !isTimeOrderValid
                    ? 'border-red-400 bg-red-50/30 text-red-900 focus:ring-red-400'
                    : 'border-slate-300 focus:ring-indigo-400'
                }`}
              />
            </div>
          </div>

          {/* ALERTA DE BLOQUEO HEURÍSTICO MATUTINO (< 12:00 h) */}
          {isMorningMeeting && (
            <div className="animate-in fade-in rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-900">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <div className="flex-1 space-y-1.5">
                  <p className="font-bold text-red-800">
                    Bloqueo Heurístico: Franja de Concentración Profunda Matutina
                  </p>
                  <p className="text-[11px] leading-relaxed text-red-700">
                    Esta app no permite reuniones antes de las 12:00 h: las mañanas se reservan para el trabajo que
                    exige más concentración.
                  </p>
                  <button
                    type="button"
                    onClick={relocateToValleyHour}
                    className="mt-1 flex items-center gap-1.5 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-red-800"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>Reubicar algorítmicamente a las 13:00 h (Hora Valle)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ALERTA ORDEN DE HORA INVÁLIDO */}
          {!isTimeOrderValid && (
            <p className="flex items-center gap-1 text-xs text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" /> La hora de fin debe ser posterior a la hora de inicio (Ley de
              Parkinson).
            </p>
          )}

          {/* AGENDA CERRADA OBLIGATORIA */}
          <div>
            <label
              htmlFor="meeting-agenda-item"
              className="mb-1 block text-xs font-bold tracking-wider text-slate-600 uppercase"
            >
              Orden del Día Cerrado (Obligatorio) <span className="text-red-500">*</span>
            </label>
            <div className="mb-2 flex gap-2">
              <input
                id="meeting-agenda-item"
                type="text"
                value={agendaInput}
                onChange={(e) => setAgendaInput(e.target.value)}
                placeholder="Punto concreto que se va a tratar..."
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none"
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
                className="flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Agregar</span>
              </button>
            </div>

            {agendaPoints.length === 0 ? (
              <p className="flex items-center gap-1 text-xs text-red-600">
                <AlertTriangle className="h-3.5 w-3.5" /> Debe especificarse al menos un punto en el orden del día.
              </p>
            ) : (
              <div className="max-h-28 space-y-1.5 overflow-y-auto pr-1">
                {agendaPoints.map((pt, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-800"
                  >
                    <span>
                      {i + 1}. {pt}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAgendaPoint(i)}
                      aria-label={`Quitar el punto ${i + 1}: ${pt}`}
                      className="text-slate-500 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DESIGNACIÓN NOMINAL OBLIGATORIA DE MODERADOR */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="meeting-moderator"
                className="mb-1 block text-xs font-bold tracking-wider text-slate-600 uppercase"
              >
                Moderador Responsable <span className="text-red-500">*</span>
              </label>
              <input
                id="meeting-moderator"
                type="text"
                value={moderatorName}
                onChange={(e) => setModeratorName(e.target.value)}
                onBlur={() => setTouched({ ...touched, moderator: true })}
                placeholder="Nombre del moderador nominal"
                className={`w-full rounded-xl border px-3 py-2 text-xs focus:ring-2 focus:outline-none ${
                  touched.moderator && !isModeratorValid
                    ? 'border-red-400 bg-red-50/20 focus:ring-red-400'
                    : 'border-slate-300 focus:ring-indigo-400'
                }`}
              />
              {touched.moderator && !isModeratorValid && (
                <p className="mt-1 text-[11px] text-red-600">Designación nominal requerida.</p>
              )}
            </div>

            <div>
              <label
                htmlFor="meeting-moderator-email"
                className="mb-1 block text-xs font-bold tracking-wider text-slate-600 uppercase"
              >
                Email del Moderador
              </label>
              <input
                id="meeting-moderator-email"
                type="email"
                value={moderatorEmail}
                onChange={(e) => setModeratorEmail(e.target.value)}
                placeholder="moderador@organizacion.com"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              />
            </div>
          </div>

          {/* CHECKLIST DE TRIPLE VALIDACIÓN EN VIVO */}
          <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
            <span className="mb-1 block font-bold text-slate-700">
              Cumplimiento de Blindaje Triángulo de las Bermudas:
            </span>
            <div className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
              <div className="flex items-center gap-1.5">
                {!isMorningMeeting && isTimeOrderValid ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                ) : (
                  <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300" />
                )}
                <span className={!isMorningMeeting ? 'text-slate-700' : 'text-slate-500'}>
                  Horario valle (≥ 12:00 h) y fin estricto
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {isAgendaValid ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                ) : (
                  <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300" />
                )}
                <span className={isAgendaValid ? 'text-slate-700' : 'text-slate-500'}>
                  Orden del día cerrado no vacío
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {isModeratorValid ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                ) : (
                  <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300" />
                )}
                <span className={isModeratorValid ? 'text-slate-700' : 'text-slate-500'}>
                  Moderador nominal responsable
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {isTitleValid ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                ) : (
                  <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300" />
                )}
                <span className={isTitleValid ? 'text-slate-700' : 'text-slate-500'}>Título ≤ 100 caracteres</span>
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
              <Check className="h-4 w-4" />
              <span>Guardar Convocatoria Blindada</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
