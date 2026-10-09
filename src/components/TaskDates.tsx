import React from 'react';
import { CalendarClock } from 'lucide-react';
import { TaskItem } from '../types';
import { formatTaskDates, getDeadlineState } from '../services/tasks';

const DEADLINE_LABEL = { overdue: 'Vencida', soon: 'Vence en menos de una semana' } as const;

// Fecha límite o intervalo de la tarea, coloreada igual que el título cuando vence o está cerca
export const TaskDates: React.FC<{ task: TaskItem }> = ({ task }) => {
  const text = formatTaskDates(task);
  if (!text) return null;
  const state = getDeadlineState(task);
  const color = state === 'overdue' ? 'text-red-600' : state === 'soon' ? 'text-violet-600' : 'text-slate-500';
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${color}`}>
      <CalendarClock className="w-3 h-3" />
      {text}
      {(state === 'overdue' || state === 'soon') && <span className="sr-only">({DEADLINE_LABEL[state]})</span>}
    </span>
  );
};
