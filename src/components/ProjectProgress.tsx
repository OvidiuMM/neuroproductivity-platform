import React from 'react';
import { Project, TaskItem } from '../types';
import { projectProgress } from '../services/projects';

// Color de la carga: poca (rojo), a medias (ámbar) o casi llena (verde)
const levelClass = (percent: number) =>
  percent >= 67 ? 'bg-emerald-500' : percent >= 34 ? 'bg-amber-400' : 'bg-red-500';

// Avance de un proyecto como una batería: se carga con las tareas hechas (sin contar las canceladas)
export const ProjectProgress: React.FC<{ project: Project; tasks: TaskItem[]; compact?: boolean }> = ({
  project,
  tasks,
  compact = false
}) => {
  const { done, total, percent } = projectProgress(project, tasks);
  if (total === 0) return <p className="text-[11px] text-slate-500">Aún no tiene tareas.</p>;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <div
        role="progressbar"
        aria-label={`Avance de «${project.title}»`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent} %: ${done} de ${total} tareas hechas`}
        className="flex items-center"
      >
        <div className={`rounded-md border-2 border-slate-400 p-0.5 ${compact ? 'h-4 w-9' : 'h-6 w-14'}`}>
          <div className={`h-full rounded-sm transition-all ${levelClass(percent)}`} style={{ width: `${percent}%` }} />
        </div>
        <div className={`w-1 rounded-r-sm bg-slate-400 ${compact ? 'h-1.5' : 'h-2.5'}`} />
      </div>
      <span className={`font-mono font-bold text-slate-900 ${compact ? 'text-xs' : 'text-sm'}`}>{percent} %</span>
      <span className="text-[11px] text-slate-600">
        {done} de {total} {total === 1 ? 'tarea hecha' : 'tareas hechas'}
      </span>
    </div>
  );
};
