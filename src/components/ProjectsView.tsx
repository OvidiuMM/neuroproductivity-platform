import React, { useEffect, useRef } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  FileDown,
  FolderKanban,
  Pencil,
  Plus,
  Target,
  Undo2
} from 'lucide-react';
import { Goal, Project, ProjectStatus, TaskItem, TaskStatus } from '../types';
import { PROJECT_STATUS_LABEL, projectDeadline, projectTasks, sortProjects } from '../services/projects';
import { DEFAULT_LIST_PREFS, arrangeTasks } from '../services/taskListing';
import { formatDay, isArchived, statusLabel } from '../services/tasks';
import { blockerOf, tasksById } from '../services/dependencies';
import { useNow } from '../hooks/useNow';
import { ProjectProgress } from './ProjectProgress';
import { TaskCard } from './TaskCard';

interface ProjectsViewProps {
  projects: Project[];
  goals: Goal[];
  tasks: TaskItem[];
  // Proyecto abierto, o ninguno para ver la lista
  selectedProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
  onNewProject: () => void;
  onEditProject: (project: Project) => void;
  onSetProjectStatus: (project: Project, status: ProjectStatus) => void;
  onAddTask: (project: Project) => void;
  onChangeTaskStatus: (task: TaskItem, status: TaskStatus) => void;
  onEditTask: (task: TaskItem) => void;
  onDeleteTask: (task: TaskItem) => void;
  onDownloadTask: (task: TaskItem) => void;
  onDownloadProject: (project: Project) => void;
  onOpenGoals: () => void;
}

const actionButton =
  'inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50';

// Avisos del plazo: fuera de plazo, termina pronto, todo hecho y tareas que vencen después del fin
const DeadlineNotice: React.FC<{ project: Project; tasks: TaskItem[]; now: Date }> = ({ project, tasks, now }) => {
  const { state, open, lateTasks } = projectDeadline(project, tasks, now);
  const remaining = `${open} ${open === 1 ? 'tarea' : 'tareas'}`;
  return (
    <>
      {state === 'overdue' && (
        <p className="flex items-start gap-1.5 text-xs font-semibold text-red-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Fuera de plazo: terminaba el {formatDay(project.endDate)} y quedan {remaining}.
        </p>
      )}
      {state === 'soon' && (
        <p className="flex items-start gap-1.5 text-xs font-semibold text-violet-700">
          <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Termina pronto, el {formatDay(project.endDate)}, y quedan {remaining}.
        </p>
      )}
      {state === 'ready' && (
        <p className="flex items-start gap-1.5 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Todas sus tareas están hechas: márcalo como terminado.
        </p>
      )}
      {lateTasks.length > 0 && (
        <p className="flex items-start gap-1.5 text-xs font-semibold text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {lateTasks.length === 1
            ? `«${lateTasks[0].title}» vence después del fin del proyecto.`
            : `${lateTasks.length} tareas vencen después del fin del proyecto.`}
        </p>
      )}
    </>
  );
};

// Una tarjeta de la lista de proyectos: nombre (abre el proyecto), meta, fin, batería y avisos
const ProjectCard: React.FC<{
  project: Project;
  goal?: Goal;
  tasks: TaskItem[];
  now: Date;
  onOpen: () => void;
}> = ({ project, goal, tasks, now, onOpen }) => (
  <li className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Abrir el proyecto «${project.title}»`}
      className="block min-h-11 w-full text-left"
    >
      <span className="block text-sm font-bold break-words text-slate-900 hover:text-indigo-700">{project.title}</span>
      <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-1 font-semibold text-indigo-700">
          <Target className="h-3 w-3" aria-hidden="true" />
          {goal?.title ?? '(Meta no disponible)'}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="h-3 w-3" aria-hidden="true" />
          {project.status === 'ACTIVE'
            ? `Termina el ${formatDay(project.endDate)}`
            : PROJECT_STATUS_LABEL[project.status]}
        </span>
      </span>
    </button>
    <ProjectProgress project={project} tasks={tasks} compact />
    <DeadlineNotice project={project} tasks={tasks} now={now} />
  </li>
);

// PROYECTOS: la lista (los activos, del que termina antes al que termina después; los terminados y archivados,
// plegados) o un proyecto abierto con sus tareas, que se editan igual que en las listas
export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  goals,
  tasks,
  selectedProjectId,
  onSelectProject,
  onNewProject,
  onEditProject,
  onSetProjectStatus,
  onAddTask,
  onChangeTaskStatus,
  onEditTask,
  onDeleteTask,
  onDownloadTask,
  onDownloadProject,
  onOpenGoals
}) => {
  const now = useNow();
  const goalsById = new Map(goals.map((g) => [g.id, g]));
  const selected = projects.find((p) => p.id === selectedProjectId);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Al abrir un proyecto (también desde «Metas») o volver a la lista, el foco va al título de lo que se ve; al
  // entrar en la sección desde la navegación, no se mueve
  // (el que se ve: uno recién creado aparece en cuanto llega de la base de datos)
  const shownId = selected?.id ?? null;
  const previousShown = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (previousShown.current !== undefined || shownId) headingRef.current?.focus();
    previousShown.current = shownId;
  }, [shownId]);

  if (selected) {
    const all = projectTasks(selected, tasks);
    const open = arrangeTasks(
      all.filter((t) => !isArchived(t)),
      DEFAULT_LIST_PREFS,
      now
    );
    const closed = all.filter(isArchived);
    const byId = tasksById(tasks);
    const goal = goalsById.get(selected.goalId);
    const active = selected.status === 'ACTIVE';
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => onSelectProject(null)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Todos los proyectos
        </button>

        <section aria-labelledby="project-title" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="space-y-1">
            <h2
              id="project-title"
              ref={headingRef}
              tabIndex={-1}
              className="text-lg font-bold break-words text-slate-900 focus:outline-none"
            >
              {selected.title}
            </h2>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1 font-semibold text-indigo-700">
                <Target className="h-3.5 w-3.5" aria-hidden="true" />
                Meta: {goal?.title ?? '(no disponible)'}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                Fin: {formatDay(selected.endDate)}
              </span>
              <span>{PROJECT_STATUS_LABEL[selected.status]}</span>
            </p>
            {selected.description && <p className="text-sm text-slate-700">{selected.description}</p>}
          </div>
          <ProjectProgress project={selected} tasks={tasks} />
          <DeadlineNotice project={selected} tasks={tasks} now={now} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onEditProject(selected)} className={actionButton}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Editar
            </button>
            {active ? (
              <>
                <button type="button" onClick={() => onSetProjectStatus(selected, 'FINISHED')} className={actionButton}>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  Marcar como terminado
                </button>
                <button type="button" onClick={() => onSetProjectStatus(selected, 'ARCHIVED')} className={actionButton}>
                  Archivar
                </button>
              </>
            ) : (
              <button type="button" onClick={() => onSetProjectStatus(selected, 'ACTIVE')} className={actionButton}>
                <Undo2 className="h-4 w-4" aria-hidden="true" />
                Reactivar
              </button>
            )}
            <button
              type="button"
              onClick={() => onDownloadProject(selected)}
              aria-label={`Descargar «${selected.title}» (JSON)`}
              className={actionButton}
            >
              <FileDown className="h-4 w-4 text-indigo-600" aria-hidden="true" />
              Descargar (JSON)
            </button>
          </div>
        </section>

        <section aria-labelledby="project-tasks-title" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <h3 id="project-tasks-title" className="text-xs font-bold tracking-wider text-slate-900 uppercase">
              Tareas por hacer ({open.length})
            </h3>
            <button
              type="button"
              onClick={() => onAddTask(selected)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Añadir tarea
            </button>
          </div>
          {open.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
              {all.length === 0 ? 'Aún no tiene tareas. Añade la primera.' : 'No quedan tareas por hacer.'}
            </p>
          ) : (
            <ol aria-label={`Tareas de «${selected.title}»`} className="space-y-2.5">
              {open.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  blocker={blockerOf(task, byId)}
                  now={now}
                  variant="top"
                  onChangeStatus={onChangeTaskStatus}
                  onEdit={onEditTask}
                  onDelete={onDeleteTask}
                  onDownload={onDownloadTask}
                />
              ))}
            </ol>
          )}
          {closed.length > 0 && (
            <details className="group rounded-xl border border-slate-200 bg-white">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-xs font-bold text-slate-700">
                Hechas y canceladas ({closed.length})
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <ul className="space-y-1 border-t border-slate-100 p-3">
                {closed.map((task) => (
                  <li key={task.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <span className="break-words text-slate-700">{task.title}</span>
                    <span className="text-[11px] text-slate-500">{statusLabel(task.status)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>
    );
  }

  const sorted = sortProjects(projects);
  const active = sorted.filter((p) => p.status === 'ACTIVE');
  const others = sorted.filter((p) => p.status !== 'ACTIVE');
  const hasGoals = goals.length > 0;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="flex items-center gap-2 text-lg font-bold text-slate-900 focus:outline-none"
          >
            <FolderKanban className="h-5 w-5 text-indigo-600" aria-hidden="true" />
            Proyectos
          </h2>
          <p className="text-xs text-slate-600">
            Opcional: agrupa tareas relacionadas, con fecha de fin, para cumplir una meta o una parte de ella. Una meta
            puede tener uno o varios proyectos. La batería muestra cuánto llevas hecho.
          </p>
        </div>
        {hasGoals && (
          <button
            type="button"
            onClick={onNewProject}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nuevo proyecto
          </button>
        )}
      </div>

      {!hasGoals ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
          <p>
            Los proyectos son opcionales y cada uno pertenece a una meta: agrupan sus tareas relacionadas. Crea tu
            primera meta en «Metas».
          </p>
          <button
            type="button"
            onClick={onOpenGoals}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white"
          >
            Ir a Metas
          </button>
        </div>
      ) : active.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
          No tienes proyectos activos.
        </p>
      ) : (
        <ul aria-label="Proyectos activos" className="grid gap-3 md:grid-cols-2">
          {active.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              goal={goalsById.get(project.goalId)}
              tasks={tasks}
              now={now}
              onOpen={() => onSelectProject(project.id)}
            />
          ))}
        </ul>
      )}

      {others.length > 0 && (
        <details className="group rounded-xl border border-slate-200 bg-white">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-xs font-bold text-slate-700">
            Terminados y archivados ({others.length})
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ul
            aria-label="Proyectos terminados y archivados"
            className="grid gap-3 border-t border-slate-100 p-3 md:grid-cols-2"
          >
            {others.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                goal={goalsById.get(project.goalId)}
                tasks={tasks}
                now={now}
                onOpen={() => onSelectProject(project.id)}
              />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};
