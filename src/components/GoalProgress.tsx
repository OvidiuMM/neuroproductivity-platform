import React from 'react';
import { Goal, TaskItem } from '../types';
import { goalProgress } from '../services/goals';
import { messages } from '../i18n/locale';

const m = messages(
  {
    noTasks: 'Aún no tiene tareas vinculadas.',
    progressOf: (title: string) => `Progreso de «${title}»`,
    valueText: (done: number, total: number) => `${done} de ${total} ${total === 1 ? 'tarea hecha' : 'tareas hechas'}`,
    summary: (done: number, total: number) => `${done} de ${total} ${total === 1 ? 'tarea hecha' : 'tareas hechas'}`
  },
  {
    noTasks: 'No linked tasks yet.',
    progressOf: (title) => `Progress of “${title}”`,
    valueText: (done, total) => `${done} of ${total} ${total === 1 ? 'task done' : 'tasks done'}`,
    summary: (done, total) => `${done} of ${total} ${total === 1 ? 'task done' : 'tasks done'}`
  }
);

// Barra de progreso de una meta: tareas vinculadas hechas sobre el total
export const GoalProgress: React.FC<{ goal: Goal; tasks: TaskItem[] }> = ({ goal, tasks }) => {
  const { done, total } = goalProgress(goal, tasks);
  if (total === 0) return <p className="text-[11px] text-slate-500">{m.noTasks}</p>;
  const percent = Math.round((done / total) * 100);
  return (
    <div className="space-y-1">
      <div
        role="progressbar"
        aria-label={m.progressOf(goal.title)}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={m.valueText(done, total)}
        className="h-2 overflow-hidden rounded-full bg-slate-100"
      >
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-[11px] text-slate-600">{m.summary(done, total)}</p>
    </div>
  );
};
