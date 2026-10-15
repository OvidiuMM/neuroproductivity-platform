import type { Project, ProjectStatus, TaskItem } from '../types';
import { WEEK_MS, isArchived, isCancelled, isDone, toLocalDate } from './tasks';

// PROYECTOS: un conjunto de tareas con fecha de fin dentro de una meta (metas → proyectos → tareas). Las tareas de un
// proyecto toman su meta (y con ella su área) al leerse, como las de una meta toman su área.

export const PROJECT_TITLE_MAX = 100;
export const PROJECT_DESCRIPTION_MAX = 280;

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  ACTIVE: 'Activo',
  FINISHED: 'Terminado',
  ARCHIVED: 'Archivado'
};

export const projectTasks = (project: Pick<Project, 'id'>, tasks: TaskItem[]) =>
  tasks.filter((task) => task.projectId === project.id);

// Avance: tareas hechas sobre el total, sin las canceladas (como en las metas), y el porcentaje
export const projectProgress = (project: Pick<Project, 'id'>, tasks: TaskItem[]) => {
  const counted = projectTasks(project, tasks).filter((task) => !isCancelled(task));
  const done = counted.filter(isDone).length;
  return { done, total: counted.length, percent: counted.length ? Math.round((done * 100) / counted.length) : 0 };
};

// Plazo de un proyecto activo:
// - overdue: ya pasó la fecha de fin y quedan tareas abiertas
// - soon: termina en menos de una semana y quedan tareas abiertas
// - ready: tiene tareas y están todas hechas o canceladas (falta marcarlo como terminado)
// También las tareas abiertas que vencen después del fin del proyecto.
export type ProjectDeadlineState = 'overdue' | 'soon' | 'ready' | 'normal';

export const projectDeadline = (project: Project, tasks: TaskItem[], now = new Date()) => {
  const all = projectTasks(project, tasks);
  const open = all.filter((task) => !isArchived(task));
  const lateTasks = open.filter((task) => task.dueDate && task.dueDate > project.endDate);
  // La fecha de fin incluye todo ese día
  const end = toLocalDate(project.endDate, '23:59');
  const remaining = end.getTime() - now.getTime();
  const state: ProjectDeadlineState =
    project.status !== 'ACTIVE'
      ? 'normal'
      : all.length > 0 && open.length === 0
        ? 'ready'
        : open.length > 0 && remaining < 0
          ? 'overdue'
          : open.length > 0 && remaining < WEEK_MS
            ? 'soon'
            : 'normal';
  return { state, open: open.length, lateTasks };
};

// Una tarea de un proyecto que existe pertenece a la meta del proyecto (un vínculo a un proyecto que ya no existe se
// ignora)
export const applyProjectGoals = (tasks: TaskItem[], projects: Project[]) => {
  const byId = new Map(projects.map((project) => [project.id, project]));
  return tasks.map((task) => {
    const project = task.projectId ? byId.get(task.projectId) : undefined;
    return project && task.goalId !== project.goalId ? { ...task, goalId: project.goalId } : task;
  });
};

export const projectsOfGoal = (goalId: string, projects: Project[]) =>
  projects.filter((project) => project.goalId === goalId);

// Primero los activos, del que termina antes al que termina después; luego los terminados y los archivados, los más
// recientes primero
const STATUS_ORDER: ProjectStatus[] = ['ACTIVE', 'FINISHED', 'ARCHIVED'];
export const sortProjects = (projects: Project[]) =>
  [...projects].sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
      (a.status === 'ACTIVE' ? a.endDate.localeCompare(b.endDate) : b.updatedAt.localeCompare(a.updatedAt)) ||
      a.title.localeCompare(b.title, 'es')
  );

// Nombre, meta y fecha de fin obligatorios; descripción opcional y corta
export const validateProject = (project: {
  title: string;
  goalId?: string;
  endDate?: string;
  description?: string;
}): string | null => {
  if (!project.title.trim()) return 'Escribe el nombre del proyecto.';
  if (project.title.trim().length > PROJECT_TITLE_MAX)
    return `El nombre no puede pasar de ${PROJECT_TITLE_MAX} caracteres.`;
  if (!project.goalId) return 'Elige la meta a la que pertenece.';
  if (!project.endDate) return 'Elige la fecha de fin.';
  if ((project.description ?? '').trim().length > PROJECT_DESCRIPTION_MAX)
    return `La descripción no puede pasar de ${PROJECT_DESCRIPTION_MAX} caracteres.`;
  return null;
};
