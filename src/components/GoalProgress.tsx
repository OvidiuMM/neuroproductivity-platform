import React from 'react';
import { Goal, TaskItem } from '../types';
import { goalProgress } from '../services/goals';

// Barra de progreso de una meta: tareas vinculadas hechas sobre el total
export const GoalProgress: React.FC<{ goal: Goal; tasks: TaskItem[] }> = ({ goal, tasks }) => {
  const { done, total } = goalProgress(goal, tasks);
  if (total === 0) return <p className="text-[11px] text-slate-500">Aún no tiene tareas vinculadas.</p>;
  const percent = Math.round((done / total) * 100);
  return (
    <div className="space-y-1">
      <div
        role="progressbar"
        aria-label={`Progreso de «${goal.title}»`}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={`${done} de ${total} tareas hechas`}
        className="h-2 overflow-hidden rounded-full bg-slate-100"
      >
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-[11px] text-slate-600">
        {done} de {total} {total === 1 ? 'tarea hecha' : 'tareas hechas'}
      </p>
    </div>
  );
};
