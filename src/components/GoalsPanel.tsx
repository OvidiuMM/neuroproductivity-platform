import React, { useState } from 'react';
import { CalendarClock, ChevronDown, Pencil, Plus, Target, Trophy, Undo2 } from 'lucide-react';
import { Goal, GoalStatus, TaskItem } from '../types';
import { goalProgress, sortGoals } from '../services/goals';
import { formatDay } from '../services/tasks';

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

interface GoalsPanelProps {
  goals: Goal[];
  tasks: TaskItem[];
  onNewGoal: () => void;
  onEditGoal: (goal: Goal) => void;
  onSetStatus: (goal: Goal, status: GoalStatus) => void;
}

const GoalRow: React.FC<{
  goal: Goal;
  tasks: TaskItem[];
  onEdit: () => void;
  onSetStatus: (status: GoalStatus) => void;
}> = ({ goal, tasks, onEdit, onSetStatus }) => (
  <li className="space-y-2 rounded-xl border border-slate-200 p-3">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 space-y-1">
        <h4
          className={`text-sm font-bold break-words ${goal.status === 'ACTIVE' ? 'text-slate-900' : 'text-slate-600'}`}
        >
          {goal.title}
        </h4>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
          <span className="font-semibold text-indigo-700">{goal.area}</span>
          {goal.targetDate && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3 w-3" aria-hidden="true" />
              Para el {formatDay(goal.targetDate)}
            </span>
          )}
          {goal.status === 'ACHIEVED' && <span className="font-semibold text-emerald-700">Lograda</span>}
          {goal.status === 'ARCHIVED' && <span className="font-semibold text-slate-500">Archivada</span>}
        </div>
        {goal.why && <p className="line-clamp-2 text-xs text-slate-600">{goal.why}</p>}
      </div>
      <div className="flex shrink-0 items-center">
        {goal.status === 'ACTIVE' ? (
          <button
            type="button"
            onClick={() => onSetStatus('ACHIEVED')}
            aria-label={`Marcar «${goal.title}» como lograda`}
            title="Marcar como lograda"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"
          >
            <Trophy className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSetStatus('ACTIVE')}
            aria-label={`Reactivar «${goal.title}»`}
            title="Reactivar"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <Undo2 className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Editar la meta «${goal.title}»`}
          title="Editar"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-indigo-50 hover:text-indigo-700"
        >
          <Pencil className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
    <GoalProgress goal={goal} tasks={tasks} />
    {goal.status === 'ACTIVE' && (
      <button
        type="button"
        onClick={() => onSetStatus('ARCHIVED')}
        className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
      >
        Archivar
      </button>
    )}
  </li>
);

// Metas de la Rueda: las activas a la vista, con su progreso; las logradas y archivadas, plegadas
export const GoalsPanel: React.FC<GoalsPanelProps> = ({ goals, tasks, onNewGoal, onEditGoal, onSetStatus }) => {
  const [showClosed, setShowClosed] = useState(false);
  const sorted = sortGoals(goals);
  const active = sorted.filter((g) => g.status === 'ACTIVE');
  const closed = sorted.filter((g) => g.status !== 'ACTIVE');
  const row = (goal: Goal) => (
    <GoalRow
      key={goal.id}
      goal={goal}
      tasks={tasks}
      onEdit={() => onEditGoal(goal)}
      onSetStatus={(status) => onSetStatus(goal, status)}
    />
  );

  return (
    <section
      aria-labelledby="goals-title"
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3
            id="goals-title"
            className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-700 uppercase"
          >
            <Target className="h-4 w-4 text-indigo-600" aria-hidden="true" />
            Metas
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Lo que quieres conseguir en cada área. Vincula tareas a una meta desde el formulario de la tarea.
          </p>
        </div>
        <button
          type="button"
          onClick={onNewGoal}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nueva meta
        </button>
      </div>

      {active.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-600">
          Aún no tienes metas activas. Elige el área de tu Rueda que más quieres mejorar y ponle una meta concreta.
        </p>
      ) : (
        <ul aria-label="Metas activas" className="grid gap-3 md:grid-cols-2">
          {active.map(row)}
        </ul>
      )}

      {closed.length > 0 && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowClosed((open) => !open)}
            aria-expanded={showClosed}
            aria-controls="goals-closed"
            className="flex min-h-11 items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showClosed ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
            Logradas y archivadas ({closed.length})
          </button>
          <ul
            id="goals-closed"
            hidden={!showClosed}
            aria-label="Metas logradas y archivadas"
            className="grid gap-3 md:grid-cols-2"
          >
            {closed.map(row)}
          </ul>
        </div>
      )}
    </section>
  );
};
