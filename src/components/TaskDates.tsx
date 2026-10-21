import React from 'react';
import { CalendarClock, Repeat, Sun } from 'lucide-react';
import { TaskItem } from '../types';
import { DEADLINE_TITLE_CLASS, formatTaskDates, getDeadlineState } from '../services/tasks';
import { describeRecurrence } from '../services/recurrence';

const DEADLINE_LABEL = { overdue: 'Vencida', soon: 'Vence en menos de una semana' } as const;

// «Hoy»: las tareas que vencen hoy se ven de un vistazo, con texto y no solo con color
export const TodayTag: React.FC = () => (
  <span className="inline-flex items-center gap-1 rounded-full bg-violet-700 px-2 py-0.5 text-[10px] font-bold text-white">
    <Sun className="h-3 w-3" aria-hidden="true" />
    Hoy
  </span>
);

// Fecha límite o intervalo de la tarea, coloreada igual que el título cuando vence o está cerca, y su repetición.
// `now` viene del reloj de la lista (useNow) para que el color cambie aunque la página siga abierta.
export const TaskDates: React.FC<{ task: TaskItem; now?: Date }> = ({ task, now }) => {
  const text = formatTaskDates(task);
  if (!text) return null;
  const state = getDeadlineState(task, now);
  const color = DEADLINE_TITLE_CLASS[state] || 'text-slate-500';
  return (
    <>
      {state === 'today' && <TodayTag />}
      <span className={`inline-flex items-center gap-1 font-semibold ${color}`}>
        <CalendarClock className="h-3 w-3" />
        {text}
        {(state === 'overdue' || state === 'soon') && <span className="sr-only">({DEADLINE_LABEL[state]})</span>}
      </span>
      {task.recurrence && (
        <span className="inline-flex items-center gap-1 font-semibold text-indigo-600">
          <Repeat className="h-3 w-3" aria-hidden="true" />
          <span className="sr-only">Se repite:</span>
          {describeRecurrence(task.recurrence, task.dueDate)}
        </span>
      )}
    </>
  );
};
