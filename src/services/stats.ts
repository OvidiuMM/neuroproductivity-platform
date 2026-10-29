import { AppTab, Goal, Project, TaskItem, WheelArea, WheelCategory, WheelOfLifeLog } from '../types';
import { areasWithGoals, latestScores } from './goals';
import { startOfWeek } from './agenda';
import { toDateString } from './recurrence';
import { dueMoment, formatDay, isArchived, isCancelled, isDone } from './tasks';
import { blockerOf, tasksById } from './dependencies';
import { projectDeadline, sortProjects } from './projects';
import { DEFAULT_AREAS, areaLabel } from './wheel';
import { messages } from '../i18n/locale';

// Estadísticas de la pantalla de Inicio, a partir de las tareas de una lista (las hechas guardan doneAt)

const DAY_MS = 24 * 60 * 60 * 1000;
export const DAILY_RANGE_DAYS = 14;
const VELOCITY_WEEKS = 4;
const RECENT_DAYS = 30;

const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export interface TaskStats {
  doneToday: number;
  doneThisWeek: number;
  doneThisMonth: number;
  // Canceladas este mes: se archivan, pero no cuentan como hechas
  cancelledThisMonth: number;
  // Hechas por día en los últimos 14 días (el último es hoy)
  daily: { date: string; count: number }[];
  // Hechas en los últimos 30 días con fecha límite: a tiempo o con retraso
  onTime: number;
  late: number;
  onTimeRate: number | null;
  // Media semanal de las últimas 4 semanas completas y la actual
  weeklyVelocity: number;
  weeklyEstimatedHours: number;
  // Días de media desde que se crea una tarea hasta que se hace (últimos 30 días)
  avgCycleDays: number | null;
  // Días seguidos con al menos una tarea hecha, contando hoy (o ayer si hoy aún no hay ninguna)
  streak: number;
  open: number;
  overdue: number;
  dueThisWeek: number;
  // Pendientes que no se pueden hacer aún: esperan a otra tarea o están marcadas como bloqueadas
  blocked: number;
  byArea: { area: WheelCategory; count: number }[];
}

const doneMoment = (task: TaskItem) => (task.doneAt ? new Date(task.doneAt) : null);

// `allTasks`: todas las tareas de la cuenta, para saber si una de esta lista espera a otra (puede estar en la otra)
export const computeStats = (tasks: TaskItem[], now = new Date(), allTasks: TaskItem[] = tasks): TaskStats => {
  const today = startOfDay(now);
  const weekStart = startOfWeek(now);
  // Siete días de calendario (no 168 horas): con el cambio de hora la semana dura una hora más o menos
  const nextWeekStart = addDays(weekStart, 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const recentFrom = addDays(today, -RECENT_DAYS + 1);
  const velocityFrom = addDays(weekStart, -7 * VELOCITY_WEEKS);

  // Solo lo hecho hasta `now` (un reloj adelantado en otro dispositivo no cuenta trabajo futuro como hecho). Las
  // canceladas no cuentan: ni como hechas ni como abiertas
  const done = tasks.filter((t) => isDone(t) && t.doneAt && new Date(t.doneAt) <= now);
  const doneSince = (from: Date) => done.filter((t) => doneMoment(t)! >= from);

  const countsByDay = new Map<string, number>();
  for (const task of done) {
    const key = toDateString(doneMoment(task)!);
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
  }
  const daily = Array.from({ length: DAILY_RANGE_DAYS }, (_, i) => {
    const date = toDateString(addDays(today, i - DAILY_RANGE_DAYS + 1));
    return { date, count: countsByDay.get(date) ?? 0 };
  });

  const recent = doneSince(recentFrom);
  const dated = recent.filter((t) => t.dueDate);
  const onTime = dated.filter((t) => doneMoment(t)! <= dueMoment(t)!).length;
  const late = dated.length - onTime;

  // Velocidad: semanas completas anteriores más la actual en curso, en proporción a lo transcurrido
  const velocityTasks = doneSince(velocityFrom);
  const weeksElapsed = VELOCITY_WEEKS + (now.getTime() - weekStart.getTime()) / DAY_MS / 7;
  const estimatedMinutes = velocityTasks.reduce((sum, t) => sum + (t.estimateMinutes ?? 0), 0);

  const cycles = recent
    .map((t) => (doneMoment(t)!.getTime() - new Date(t.createdAt).getTime()) / DAY_MS)
    .filter((d) => d >= 0);

  let streak = 0;
  for (
    let day = countsByDay.get(toDateString(today)) ? today : addDays(today, -1);
    countsByDay.get(toDateString(day));
    day = addDays(day, -1)
  ) {
    streak++;
  }

  const open = tasks.filter((t) => !isArchived(t) && !t.isSomeday);
  const byId = tasksById(allTasks);
  const cancelledThisMonth = tasks.filter(
    (t) => isCancelled(t) && t.doneAt && new Date(t.doneAt) >= monthStart && new Date(t.doneAt) <= now
  ).length;
  const areaCounts = new Map<WheelCategory, number>();
  for (const task of recent) {
    if (task.wheelCategory) areaCounts.set(task.wheelCategory, (areaCounts.get(task.wheelCategory) ?? 0) + 1);
  }

  return {
    doneToday: countsByDay.get(toDateString(today)) ?? 0,
    doneThisWeek: doneSince(weekStart).length,
    doneThisMonth: doneSince(monthStart).length,
    cancelledThisMonth,
    daily,
    onTime,
    late,
    onTimeRate: dated.length ? onTime / dated.length : null,
    weeklyVelocity: velocityTasks.length / weeksElapsed,
    weeklyEstimatedHours: estimatedMinutes / 60 / weeksElapsed,
    avgCycleDays: cycles.length ? cycles.reduce((a, b) => a + b, 0) / cycles.length : null,
    streak,
    open: open.length,
    overdue: open.filter((t) => dueMoment(t) && dueMoment(t)! < now).length,
    dueThisWeek: open.filter((t) => {
      const due = dueMoment(t);
      return due && due >= now && due < nextWeekStart;
    }).length,
    blocked: open.filter((t) => t.status === 'BLOCKED' || blockerOf(t, byId)).length,
    byArea: [...areaCounts.entries()].map(([area, count]) => ({ area, count })).sort((a, b) => b.count - a.count)
  };
};

export interface Recommendation {
  id: string;
  text: string;
  action?: { label: string; tab: AppTab };
}

const m = messages(
  {
    projectOverdue: (title: string, day: string, open: number) =>
      `El proyecto «${title}» va fuera de plazo: terminaba el ${day} y le ${open === 1 ? 'queda 1 tarea' : `quedan ${open} tareas`}. Cambia la fecha de fin o reparte sus tareas.`,
    viewProjects: 'Ver los proyectos',
    overdueOne: (title: string) => `Tienes una tarea vencida: «${title}». Hazla o cámbiale el plazo.`,
    overdueMany: (count: number, title: string) =>
      `Tienes ${count} tareas vencidas. Empieza por la más antigua: «${title}».`,
    viewAgenda: 'Ver la agenda',
    busyWeek: (count: number) =>
      `Esta semana vencen ${count} tareas. Revisa si alguna puede esperar o pasar a «Algún día».`,
    viewLists: 'Ver las listas',
    late: (percent: number) =>
      `En el último mes terminaste a tiempo el ${percent} % de las tareas con plazo. Prueba a dividir las largas o a poner plazos más realistas.`,
    restart: 'Esta semana aún no has completado ninguna tarea. Elige una corta del Top 10 y hazla hoy.',
    goal: (area: string, score: number | undefined) =>
      `«${area}» tiene ${score}/10 en tu última evaluación y aún no tiene metas. Ponle una meta concreta y añádele la primera tarea.`,
    goToGoals: 'Ir a Metas',
    wheelStale:
      'Hace más de un mes que no evalúas tu Rueda de la Vida. Revisarla ayuda a elegir en qué centrarte y qué metas ponerte.',
    wheelNever: 'Aún no has evaluado tu Rueda de la Vida. Es el punto de partida para elegir tus metas.',
    goToWheel: 'Ir a la Rueda'
  },
  {
    projectOverdue: (title, day, open) =>
      `The project “${title}” is overdue: it was due to end on ${day} and ${open === 1 ? 'has 1 task left' : `has ${open} tasks left`}. Change its end date or spread out its tasks.`,
    viewProjects: 'View projects',
    overdueOne: (title) => `You have an overdue task: “${title}”. Do it or change its deadline.`,
    overdueMany: (count, title) => `You have ${count} overdue tasks. Start with the oldest: “${title}”.`,
    viewAgenda: 'View the agenda',
    busyWeek: (count) => `${count} tasks are due this week. See if any can wait or move to “Someday”.`,
    viewLists: 'View lists',
    late: (percent) =>
      `In the last month you finished ${percent}% of your tasks with a deadline on time. Try splitting the long ones or setting more realistic deadlines.`,
    restart: 'You haven’t completed any tasks this week yet. Pick a short one from your Top 10 and do it today.',
    goal: (area, score) =>
      `“${area}” scored ${score}/10 in your last assessment and has no goals yet. Set a concrete goal and add its first task.`,
    goToGoals: 'Go to Goals',
    wheelStale:
      'You haven’t assessed your Wheel of Life in over a month. Reviewing it helps you choose what to focus on and which goals to set.',
    wheelNever: 'You haven’t assessed your Wheel of Life yet. It’s the starting point for choosing your goals.',
    goToWheel: 'Go to the Wheel'
  }
);

// Recomendaciones sencillas a partir de las estadísticas y las metas (como mucho tres, de más a menos urgente)
export const recommendationsFor = (
  stats: TaskStats,
  tasks: TaskItem[],
  wheelLogs: WheelOfLifeLog[],
  now = new Date(),
  goals: Goal[] = [],
  areas: WheelArea[] = DEFAULT_AREAS,
  // Proyectos y todas las tareas de la cuenta (las de un proyecto pueden ser de las dos listas)
  projects: Project[] = [],
  allTasks: TaskItem[] = tasks
): Recommendation[] => {
  const list: Recommendation[] = [];
  // El proyecto que termina antes de los que ya van fuera de plazo
  const late = sortProjects(projects)
    .map((project) => ({ project, deadline: projectDeadline(project, allTasks, now) }))
    .find(({ deadline }) => deadline.state === 'overdue');
  if (late) {
    const { project, deadline } = late;
    const open = deadline.open;
    list.push({
      id: 'project-overdue',
      text: m.projectOverdue(project.title, formatDay(project.endDate), open),
      action: { label: m.viewProjects, tab: 'projects' }
    });
  }
  if (stats.overdue > 0) {
    const oldest = tasks
      .filter((t) => !isArchived(t) && !t.isSomeday && dueMoment(t) && dueMoment(t)! < now)
      .sort((a, b) => dueMoment(a)!.getTime() - dueMoment(b)!.getTime())[0];
    list.push({
      id: 'overdue',
      text: stats.overdue === 1 ? m.overdueOne(oldest.title) : m.overdueMany(stats.overdue, oldest.title),
      action: { label: m.viewAgenda, tab: 'agenda' }
    });
  }
  if (stats.dueThisWeek >= 5) {
    list.push({
      id: 'busy-week',
      text: m.busyWeek(stats.dueThisWeek),
      action: { label: m.viewLists, tab: 'tasks' }
    });
  }
  if (stats.onTimeRate !== null && stats.onTime + stats.late >= 5 && stats.onTimeRate < 0.6) {
    list.push({
      id: 'late',
      text: m.late(Math.round(stats.onTimeRate * 100))
    });
  }
  if (stats.open > 0 && stats.doneThisWeek === 0) {
    list.push({
      id: 'restart',
      text: m.restart,
      action: { label: m.viewLists, tab: 'tasks' }
    });
  }
  // El área más baja de la última evaluación, si necesita atención y aún no tiene metas
  const [weakest] = areasWithGoals(goals, latestScores(wheelLogs), areas);
  if (weakest?.weak && weakest.goals.length === 0) {
    list.push({
      id: 'goal',
      text: m.goal(areaLabel(areas, weakest.area), weakest.score),
      action: { label: m.goToGoals, tab: 'goals' }
    });
  }
  const lastWheel = wheelLogs[wheelLogs.length - 1];
  if (!lastWheel || now.getTime() - new Date(lastWheel.timestamp).getTime() > RECENT_DAYS * DAY_MS) {
    list.push({
      id: 'wheel',
      text: lastWheel ? m.wheelStale : m.wheelNever,
      action: { label: m.goToWheel, tab: 'wheel' }
    });
  }
  return list.slice(0, 3);
};
