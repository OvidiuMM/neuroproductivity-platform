import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  ChevronDown,
  Compass,
  FileDown,
  FolderKanban,
  FolderPlus,
  Pencil,
  Plus,
  Target,
  Trophy,
  Undo2
} from 'lucide-react';
import { Goal, GoalStatus, Project, TaskItem, WheelCategory } from '../types';
import { WEAK_AREA_SCORE, areasWithGoals, pendingGoalTasks, sortGoals } from '../services/goals';
import { DEADLINE_TITLE_CLASS, formatDay, getDeadlineState, statusLabel } from '../services/tasks';
import { TodayTag } from './TaskDates';
import { useNow } from '../hooks/useNow';
import { GoalProgress } from './GoalProgress';
import { useAreas } from '../hooks/useAreas';
import { projectProgress, projectsOfGoal, sortProjects } from '../services/projects';

interface GoalsViewProps {
  goals: Goal[];
  tasks: TaskItem[];
  // Puntuaciones de la última evaluación de la Rueda; null si aún no hay ninguna, undefined mientras se confirma
  scores: Partial<Record<WheelCategory, number>> | null | undefined;
  onNewGoal: (area?: WheelCategory) => void;
  onEditGoal: (goal: Goal) => void;
  onSetGoalStatus: (goal: Goal, status: GoalStatus) => void;
  onAddTask: (goal: Goal) => void;
  onEditTask: (task: TaskItem) => void;
  onOpenWheel: () => void;
  projects: Project[];
  onOpenProject: (project: Project) => void;
  onNewProject: (goal: Goal) => void;
  onDownloadGoal: (goal: Goal) => void;
}

const iconButton = 'flex h-11 w-11 items-center justify-center rounded-xl text-slate-500';
const linkButton =
  'inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 hover:text-indigo-900';

// Una meta: su para qué, fecha, progreso y las tareas que quedan por hacer, con «Añadir tarea»
const GoalCard: React.FC<{
  goal: Goal;
  tasks: TaskItem[];
  projects: Project[];
  now: Date;
  onEdit: () => void;
  onSetStatus: (status: GoalStatus) => void;
  onAddTask: () => void;
  onEditTask: (task: TaskItem) => void;
  onOpenProject: (project: Project) => void;
  onNewProject: () => void;
  onDownload: () => void;
}> = ({
  goal,
  tasks,
  projects,
  now,
  onEdit,
  onSetStatus,
  onAddTask,
  onEditTask,
  onOpenProject,
  onNewProject,
  onDownload
}) => {
  const active = goal.status === 'ACTIVE';
  const { label: areaName } = useAreas();
  const pending = active ? pendingGoalTasks(goal, tasks) : [];
  // Sus proyectos activos, con su avance
  const goalProjects = sortProjects(projectsOfGoal(goal.id, projects)).filter((p) => p.status === 'ACTIVE');
  return (
    <li className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h4 className={`text-sm font-bold break-words ${active ? 'text-slate-900' : 'text-slate-600'}`}>
            {goal.title}
          </h4>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
            {!active && <span className="font-semibold text-indigo-700">{areaName(goal.area)}</span>}
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
          {active ? (
            <button
              type="button"
              onClick={() => onSetStatus('ACHIEVED')}
              aria-label={`Marcar «${goal.title}» como lograda`}
              title="Marcar como lograda"
              className={`${iconButton} hover:bg-emerald-50 hover:text-emerald-700`}
            >
              <Trophy className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSetStatus('ACTIVE')}
              aria-label={`Reactivar «${goal.title}»`}
              title="Reactivar"
              className={`${iconButton} hover:bg-slate-100 hover:text-slate-800`}
            >
              <Undo2 className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={onDownload}
            aria-label={`Descargar la meta «${goal.title}» (JSON)`}
            title="Descargar (JSON)"
            className={`${iconButton} hover:bg-indigo-50 hover:text-indigo-700`}
          >
            <FileDown className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Editar la meta «${goal.title}»`}
            title="Editar"
            className={`${iconButton} hover:bg-indigo-50 hover:text-indigo-700`}
          >
            <Pencil className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <GoalProgress goal={goal} tasks={tasks} />

      {goalProjects.length > 0 && (
        <ul aria-label={`Proyectos de «${goal.title}»`} className="space-y-1">
          {goalProjects.map((project) => (
            <li key={project.id}>
              <button
                type="button"
                onClick={() => onOpenProject(project)}
                aria-label={`Abrir el proyecto «${project.title}»`}
                className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-2 text-left hover:bg-slate-50"
              >
                <span className="flex min-w-0 items-center gap-1.5 text-sm break-words text-slate-800">
                  <FolderKanban className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
                  {project.title}
                </span>
                <span className="shrink-0 font-mono text-xs font-bold text-slate-700">
                  {projectProgress(project, tasks).percent} %
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {pending.length > 0 && (
        <ul aria-label={`Tareas por hacer de «${goal.title}»`} className="space-y-1">
          {pending.map((task) => {
            // Con los colores del plazo de las listas; las que vencen hoy, además, en negrita y con «Hoy»
            const deadline = getDeadlineState(task, now);
            const today = deadline === 'today';
            return (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => onEditTask(task)}
                  className="flex min-h-11 w-full flex-col justify-center rounded-lg px-2 text-left hover:bg-slate-50"
                >
                  <span
                    className={`text-sm break-words ${today ? 'font-bold' : ''} ${DEADLINE_TITLE_CLASS[deadline] || 'text-slate-800'}`}
                  >
                    {task.title}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {today && (
                      <>
                        <TodayTag />{' '}
                      </>
                    )}
                    {task.listContext === 'WORK' ? 'Profesional' : 'Personal'}
                    {task.dueDate && ` · Vence el ${formatDay(task.dueDate)}`}
                    {task.status !== 'PENDING' && ` · ${statusLabel(task.status)}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {active && (
        <div className="-ml-2 flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={onAddTask}
            aria-label={`Añadir tarea a «${goal.title}»`}
            className={linkButton}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Añadir tarea
          </button>
          <button
            type="button"
            onClick={onNewProject}
            aria-label={`Nuevo proyecto para «${goal.title}»`}
            className={linkButton}
          >
            <FolderPlus className="h-4 w-4" aria-hidden="true" />
            Nuevo proyecto
          </button>
          <button
            type="button"
            onClick={() => onSetStatus('ARCHIVED')}
            className="min-h-11 rounded-lg px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-800"
          >
            Archivar
          </button>
        </div>
      )}
    </li>
  );
};

// METAS: el paso entre la Rueda y las tareas. Las áreas van de menor a mayor puntuación, cada una con sus metas
// activas; las flojas sin metas se señalan arriba. Las metas logradas y archivadas, plegadas al final.
export const GoalsView: React.FC<GoalsViewProps> = ({
  goals,
  tasks,
  scores,
  onNewGoal,
  onEditGoal,
  onSetGoalStatus,
  onAddTask,
  onEditTask,
  onOpenWheel,
  projects,
  onOpenProject,
  onNewProject,
  onDownloadGoal
}) => {
  const [showClosed, setShowClosed] = useState(false);
  const now = useNow();
  // Botón «Nueva meta» de cada área: siempre está, así que es donde vuelve el foco al crear una meta desde «Necesitan
  // atención» (ese botón desaparece en cuanto el área tiene meta)
  const areaButtons = useRef<Partial<Record<WheelCategory, HTMLButtonElement | null>>>({});
  const newGoalFromAttention = (area: WheelCategory) => {
    areaButtons.current[area]?.focus({ preventScroll: true });
    onNewGoal(area);
  };
  const { areas: wheelAreas, label: areaName } = useAreas();
  const areas = areasWithGoals(goals, scores ?? null, wheelAreas);
  const needAttention = areas.filter((a) => a.weak && a.goals.length === 0);
  const closed = sortGoals(goals).filter((g) => g.status !== 'ACTIVE');
  const card = (goal: Goal) => (
    <GoalCard
      key={goal.id}
      goal={goal}
      tasks={tasks}
      projects={projects}
      now={now}
      onEdit={() => onEditGoal(goal)}
      onSetStatus={(status) => onSetGoalStatus(goal, status)}
      onAddTask={() => onAddTask(goal)}
      onEditTask={onEditTask}
      onOpenProject={onOpenProject}
      onNewProject={() => onNewProject(goal)}
      onDownload={() => onDownloadGoal(goal)}
    />
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Target className="h-6 w-6 text-indigo-600" aria-hidden="true" />
            Metas
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-slate-600">
            Lo que quieres conseguir en cada área de tu Rueda. Cada meta se consigue con tareas: añádeselas y verás cómo
            avanza.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNewGoal()}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nueva meta
        </button>
      </div>

      {/* Sin evaluación no se sabe qué áreas necesitan atención: se invita a hacerla */}
      {scores === null && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="flex items-start gap-2 text-sm text-indigo-950">
            <Compass className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" aria-hidden="true" />
            Evalúa tu Rueda de la Vida para ver qué áreas necesitan más atención.
          </p>
          <button type="button" onClick={onOpenWheel} className={linkButton}>
            Ir a la Rueda <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {needAttention.length > 0 && (
        <section
          aria-labelledby="goals-attention-title"
          className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"
        >
          <h3 id="goals-attention-title" className="flex items-center gap-2 text-sm font-bold text-amber-950">
            <AlertTriangle className="h-4 w-4 text-amber-700" aria-hidden="true" />
            Necesitan atención
          </h3>
          <p className="text-xs text-amber-950">
            Estas áreas tienen {WEAK_AREA_SCORE} o menos en tu última evaluación y aún no tienen metas.
          </p>
          <ul className="flex flex-wrap gap-2">
            {needAttention.map(({ area, score }) => (
              <li key={area}>
                <button
                  type="button"
                  onClick={() => newGoalFromAttention(area)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-950 hover:bg-amber-100"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Ponle una meta a {areaName(area)} ({score}/10)
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ÁREAS: de menor a mayor puntuación. Las que no tienen metas ocupan una sola línea */}
      <div className="space-y-3">
        {areas.map(({ area, score, goals: areaGoals, weak }, index) => (
          <section
            key={area}
            aria-labelledby={`goals-area-${index}`}
            className={`rounded-2xl border border-slate-200 bg-slate-50/60 px-4 ${areaGoals.length > 0 ? 'space-y-3 py-4' : 'py-1.5'}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-x-2">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <h3 id={`goals-area-${index}`} className="text-sm font-bold text-slate-900">
                  {areaName(area)}
                  {score !== undefined && (
                    <span className={`ml-2 text-xs font-semibold ${weak ? 'text-amber-800' : 'text-slate-500'}`}>
                      {' '}
                      {score}/10
                    </span>
                  )}
                </h3>
                {areaGoals.length === 0 && <p className="text-xs text-slate-500">Sin metas activas</p>}
              </div>
              <button
                type="button"
                ref={(button) => {
                  areaButtons.current[area] = button;
                }}
                onClick={() => onNewGoal(area)}
                aria-label={`Nueva meta en ${areaName(area)}`}
                className={linkButton}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Nueva meta
              </button>
            </div>
            {areaGoals.length > 0 && (
              <ul aria-label={`Metas de ${areaName(area)}`} className="grid gap-3 lg:grid-cols-2">
                {areaGoals.map(card)}
              </ul>
            )}
          </section>
        ))}
      </div>

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
            className="grid gap-3 lg:grid-cols-2"
          >
            {closed.map(card)}
          </ul>
        </div>
      )}
    </div>
  );
};
