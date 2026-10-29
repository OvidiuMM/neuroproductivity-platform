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
import { messages } from '../i18n/locale';

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

const m = messages(
  {
    tasks: (n: number) => `${n} ${n === 1 ? 'tarea' : 'tareas'}`,
    overdue: (day: string, remaining: string) => `Fuera de plazo: terminaba el ${day} y quedan ${remaining}.`,
    soon: (day: string, remaining: string) => `Termina pronto, el ${day}, y quedan ${remaining}.`,
    ready: 'Todas sus tareas están hechas: márcalo como terminado.',
    lateOne: (title: string) => `«${title}» vence después del fin del proyecto.`,
    lateMany: (n: number) => `${n} tareas vencen después del fin del proyecto.`,
    openProject: (title: string) => `Abrir el proyecto «${title}»`,
    noGoal: '(Meta no disponible)',
    endsOn: (day: string) => `Termina el ${day}`,
    allProjects: 'Todos los proyectos',
    goal: (title: string | undefined) => `Meta: ${title ?? '(no disponible)'}`,
    end: (day: string) => `Fin: ${day}`,
    edit: 'Editar',
    markFinished: 'Marcar como terminado',
    archive: 'Archivar',
    reactivate: 'Reactivar',
    downloadOf: (title: string) => `Descargar «${title}» (JSON)`,
    download: 'Descargar (JSON)',
    todo: (n: number) => `Tareas por hacer (${n})`,
    addTask: 'Añadir tarea',
    noTasks: 'Aún no tiene tareas. Añade la primera.',
    noneLeft: 'No quedan tareas por hacer.',
    tasksOf: (title: string) => `Tareas de «${title}»`,
    closedTasks: (n: number) => `Hechas y canceladas (${n})`,
    projects: 'Proyectos',
    intro:
      'Opcional: agrupa tareas relacionadas, con fecha de fin, para cumplir una meta o una parte de ella. Una meta puede tener uno o varios proyectos. La batería muestra cuánto llevas hecho.',
    newProject: 'Nuevo proyecto',
    noGoals:
      'Los proyectos son opcionales y cada uno pertenece a una meta: agrupan sus tareas relacionadas. Crea tu primera meta en «Metas».',
    goToGoals: 'Ir a Metas',
    noActive: 'No tienes proyectos activos.',
    activeList: 'Proyectos activos',
    closedProjects: (n: number) => `Terminados y archivados (${n})`,
    closedList: 'Proyectos terminados y archivados'
  },
  {
    tasks: (n) => `${n} ${n === 1 ? 'task' : 'tasks'}`,
    overdue: (day, remaining) => `Overdue: it was due to end on ${day} and ${remaining} left.`,
    soon: (day, remaining) => `Ends soon, on ${day}, and ${remaining} left.`,
    ready: 'All its tasks are done: mark it as finished.',
    lateOne: (title) => `“${title}” is due after the project ends.`,
    lateMany: (n) => `${n} tasks are due after the project ends.`,
    openProject: (title) => `Open the project “${title}”`,
    noGoal: '(Goal not available)',
    endsOn: (day) => `Ends on ${day}`,
    allProjects: 'All projects',
    goal: (title) => `Goal: ${title ?? '(not available)'}`,
    end: (day) => `End: ${day}`,
    edit: 'Edit',
    markFinished: 'Mark as finished',
    archive: 'Archive',
    reactivate: 'Reactivate',
    downloadOf: (title) => `Download “${title}” (JSON)`,
    download: 'Download (JSON)',
    todo: (n) => `Tasks to do (${n})`,
    addTask: 'Add task',
    noTasks: 'No tasks yet. Add the first one.',
    noneLeft: 'No tasks left to do.',
    tasksOf: (title) => `Tasks of “${title}”`,
    closedTasks: (n) => `Done and canceled (${n})`,
    projects: 'Projects',
    intro:
      'Optional: group related tasks, with an end date, to reach a goal or part of one. A goal can have one or more projects. The battery shows how much you’ve done.',
    newProject: 'New project',
    noGoals:
      'Projects are optional and each one belongs to a goal: they group its related tasks. Create your first goal in “Goals”.',
    goToGoals: 'Go to Goals',
    noActive: 'You have no active projects.',
    activeList: 'Active projects',
    closedProjects: (n) => `Finished and archived (${n})`,
    closedList: 'Finished and archived projects'
  }
);

const actionButton =
  'inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50';

// Avisos del plazo: fuera de plazo, termina pronto, todo hecho y tareas que vencen después del fin
const DeadlineNotice: React.FC<{ project: Project; tasks: TaskItem[]; now: Date }> = ({ project, tasks, now }) => {
  const { state, open, lateTasks } = projectDeadline(project, tasks, now);
  const remaining = m.tasks(open);
  return (
    <>
      {state === 'overdue' && (
        <p className="flex items-start gap-1.5 text-xs font-semibold text-red-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {m.overdue(formatDay(project.endDate), remaining)}
        </p>
      )}
      {state === 'soon' && (
        <p className="flex items-start gap-1.5 text-xs font-semibold text-violet-700">
          <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {m.soon(formatDay(project.endDate), remaining)}
        </p>
      )}
      {state === 'ready' && (
        <p className="flex items-start gap-1.5 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {m.ready}
        </p>
      )}
      {lateTasks.length > 0 && (
        <p className="flex items-start gap-1.5 text-xs font-semibold text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {lateTasks.length === 1 ? m.lateOne(lateTasks[0].title) : m.lateMany(lateTasks.length)}
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
      aria-label={m.openProject(project.title)}
      className="block min-h-11 w-full text-left"
    >
      <span className="block text-sm font-bold wrap-anywhere text-slate-900 hover:text-indigo-700">
        {project.title}
      </span>
      <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-1 font-semibold text-indigo-700">
          <Target className="h-3 w-3" aria-hidden="true" />
          {goal?.title ?? m.noGoal}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="h-3 w-3" aria-hidden="true" />
          {project.status === 'ACTIVE' ? m.endsOn(formatDay(project.endDate)) : PROJECT_STATUS_LABEL[project.status]}
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
          {m.allProjects}
        </button>

        <section aria-labelledby="project-title" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="space-y-1">
            <h2
              id="project-title"
              ref={headingRef}
              tabIndex={-1}
              className="text-lg font-bold wrap-anywhere text-slate-900 focus:outline-none"
            >
              {selected.title}
            </h2>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1 font-semibold text-indigo-700">
                <Target className="h-3.5 w-3.5" aria-hidden="true" />
                {m.goal(goal?.title)}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                {m.end(formatDay(selected.endDate))}
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
              {m.edit}
            </button>
            {active ? (
              <>
                <button type="button" onClick={() => onSetProjectStatus(selected, 'FINISHED')} className={actionButton}>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  {m.markFinished}
                </button>
                <button type="button" onClick={() => onSetProjectStatus(selected, 'ARCHIVED')} className={actionButton}>
                  {m.archive}
                </button>
              </>
            ) : (
              <button type="button" onClick={() => onSetProjectStatus(selected, 'ACTIVE')} className={actionButton}>
                <Undo2 className="h-4 w-4" aria-hidden="true" />
                {m.reactivate}
              </button>
            )}
            <button
              type="button"
              onClick={() => onDownloadProject(selected)}
              aria-label={m.downloadOf(selected.title)}
              className={actionButton}
            >
              <FileDown className="h-4 w-4 text-indigo-600" aria-hidden="true" />
              {m.download}
            </button>
          </div>
        </section>

        <section aria-labelledby="project-tasks-title" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <h3 id="project-tasks-title" className="text-xs font-bold tracking-wider text-slate-900 uppercase">
              {m.todo(open.length)}
            </h3>
            <button
              type="button"
              onClick={() => onAddTask(selected)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {m.addTask}
            </button>
          </div>
          {open.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
              {all.length === 0 ? m.noTasks : m.noneLeft}
            </p>
          ) : (
            <ol aria-label={m.tasksOf(selected.title)} className="space-y-2.5">
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
                {m.closedTasks(closed.length)}
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <ul className="space-y-1 border-t border-slate-100 p-3">
                {closed.map((task) => (
                  <li key={task.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <span className="wrap-anywhere text-slate-700">{task.title}</span>
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
            {m.projects}
          </h2>
          <p className="text-xs text-slate-600">{m.intro}</p>
        </div>
        {hasGoals && (
          <button
            type="button"
            onClick={onNewProject}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {m.newProject}
          </button>
        )}
      </div>

      {!hasGoals ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
          <p>{m.noGoals}</p>
          <button
            type="button"
            onClick={onOpenGoals}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white"
          >
            {m.goToGoals}
          </button>
        </div>
      ) : active.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
          {m.noActive}
        </p>
      ) : (
        <ul aria-label={m.activeList} className="grid gap-3 md:grid-cols-2">
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
            {m.closedProjects(others.length)}
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ul aria-label={m.closedList} className="grid gap-3 border-t border-slate-100 p-3 md:grid-cols-2">
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
