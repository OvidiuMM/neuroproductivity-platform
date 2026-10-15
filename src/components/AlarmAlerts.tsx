import React from 'react';
import { BellRing, X } from 'lucide-react';
import type { TaskItem } from '../types';
import type { ScheduledAlarm } from '../services/alarms';
import { formatTaskDates } from '../services/tasks';

interface AlarmAlertsProps {
  alarms: ScheduledAlarm[];
  // Con otra ventana abierta no se ofrece «Ver tarea»: abrirla encima podría perder lo que se está editando
  canOpenTask: boolean;
  onOpenTask: (task: TaskItem) => void;
  onDismiss: (key: string) => void;
}

// Avisos de alarma dentro de la app, arriba de la pantalla. Se quedan hasta cerrarlos. La región viva está siempre en
// la página para que los lectores de pantalla anuncien al momento cada aviso nuevo.
export const AlarmAlerts: React.FC<AlarmAlertsProps> = ({ alarms, canOpenTask, onOpenTask, onDismiss }) => (
  <div
    aria-live="assertive"
    className="pointer-events-none fixed inset-x-0 top-[calc(0.75rem+env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2 px-3"
  >
    {alarms.map(({ key, task }) => (
      <section
        key={key}
        aria-label={`Alarma: ${task.title}`}
        className="animate-in slide-in-from-top-3 pointer-events-auto w-full max-w-md rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-xl duration-200"
      >
        <div className="flex items-start gap-3">
          <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold tracking-wider text-amber-900 uppercase">Alarma</p>
            <p className="mt-0.5 text-sm font-semibold break-words text-slate-900">{task.title}</p>
            <p className="text-xs text-slate-700">{formatTaskDates(task)}</p>
          </div>
          <button
            type="button"
            onClick={() => onDismiss(key)}
            aria-label={`Cerrar la alarma de «${task.title}»`}
            className="-mt-1 -mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-amber-900 hover:bg-amber-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {canOpenTask && (
          <button
            type="button"
            onClick={() => onOpenTask(task)}
            className="mt-2 ml-8 min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800"
          >
            Ver tarea
          </button>
        )}
      </section>
    ))}
  </div>
);
