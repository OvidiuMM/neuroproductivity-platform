import type { Goal, Project, TaskItem, WheelArea } from '../types';
import { goalProgress } from './goals';
import { projectDeadline, projectProgress, projectTasks } from './projects';
import { dependentsOf } from './dependencies';
import { fileSlug } from './download';
import { DEFAULT_AREAS, areaLabel } from './wheel';
import { messages } from '../i18n/locale';

// La palabra del nombre del archivo, en el idioma de la app («clar-tarea-…», «clar-task-…»)
const FILE_KIND = messages(
  { tarea: 'tarea', meta: 'meta', proyecto: 'proyecto' },
  { tarea: 'task', meta: 'goal', proyecto: 'project' }
);

// DESCARGAS EN JSON de una tarea, una meta o un proyecto, con todos sus datos y lo necesario para entenderlas solas:
// los nombres de su meta, su proyecto y las tareas de las que dependen, y las tareas asociadas.

interface ExportContext {
  tasks: TaskItem[];
  goals: Goal[];
  projects: Project[];
  version: string;
  now?: Date;
  // Para dar el nombre de las áreas (cada cuenta puede cambiarlo); sin ellas, las de partida
  areas?: WheelArea[];
}

const header = (type: 'task' | 'goal' | 'project', { version, now = new Date() }: ExportContext) => ({
  app: 'CLAR',
  version,
  type,
  exportedAt: now.toISOString()
});

const taskRef = (task: TaskItem) => ({ id: task.id, title: task.title, status: task.status });
const goalRef = (goal: Goal, areas: WheelArea[]) => ({
  id: goal.id,
  title: goal.title,
  area: goal.area,
  areaLabel: areaLabel(areas, goal.area),
  status: goal.status
});
const projectRef = (project: Project) => ({
  id: project.id,
  title: project.title,
  endDate: project.endDate,
  status: project.status
});

// Una tarea con todos sus campos y, para entenderla, su meta, su proyecto, la tarea a la que espera y las que esperan
// a ella
export const taskExport = (task: TaskItem, context: ExportContext) => {
  const goal = context.goals.find((g) => g.id === task.goalId);
  const project = context.projects.find((p) => p.id === task.projectId);
  const waitsFor = context.tasks.find((t) => t.id === task.dependsOn);
  const areas = context.areas ?? DEFAULT_AREAS;
  return {
    ...header('task', context),
    task,
    related: {
      area: task.wheelCategory ? { id: task.wheelCategory, label: areaLabel(areas, task.wheelCategory) } : null,
      goal: goal ? goalRef(goal, areas) : null,
      project: project ? projectRef(project) : null,
      waitsFor: waitsFor ? taskRef(waitsFor) : null,
      waitedBy: dependentsOf(task, context.tasks).map(taskRef)
    }
  };
};

// Una meta con su avance, sus proyectos (con el suyo) y todas sus tareas, también las de sus proyectos
export const goalExport = (goal: Goal, context: ExportContext) => ({
  ...header('goal', context),
  goal,
  areaLabel: areaLabel(context.areas ?? DEFAULT_AREAS, goal.area),
  progress: goalProgress(goal, context.tasks),
  projects: context.projects
    .filter((p) => p.goalId === goal.id)
    .map((project) => ({ ...project, progress: projectProgress(project, context.tasks) })),
  tasks: context.tasks.filter((t) => t.goalId === goal.id)
});

// Un proyecto con su meta, su avance, el estado de su plazo y todas sus tareas
export const projectExport = (project: Project, context: ExportContext) => {
  const goal = context.goals.find((g) => g.id === project.goalId);
  const deadline = projectDeadline(project, context.tasks, context.now);
  return {
    ...header('project', context),
    project,
    goal: goal ? goalRef(goal, context.areas ?? DEFAULT_AREAS) : null,
    progress: projectProgress(project, context.tasks),
    deadline: { state: deadline.state, openTasks: deadline.open, tasksDueAfterEnd: deadline.lateTasks.map(taskRef) },
    tasks: projectTasks(project, context.tasks)
  };
};

// clar-tarea-llamar-al-proveedor-2026-10-15.json
export const exportFilename = (kind: 'tarea' | 'meta' | 'proyecto', title: string, now = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const word = FILE_KIND[kind];
  return `clar-${word}-${fileSlug(title, word).toLowerCase()}-${day}.json`;
};
