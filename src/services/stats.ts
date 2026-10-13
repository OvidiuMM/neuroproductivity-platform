import { AppTab, TaskItem, WheelCategory, WheelOfLifeLog } from '../types';
import { startOfWeek } from './agenda';
import { toDateString } from './recurrence';
import { dueMoment, isArchived } from './tasks';

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
  byArea: { area: WheelCategory; count: number }[];
}

const doneMoment = (task: TaskItem) => (task.doneAt ? new Date(task.doneAt) : null);

export const computeStats = (tasks: TaskItem[], now = new Date()): TaskStats => {
  const today = startOfDay(now);
  const weekStart = startOfWeek(now);
  // Siete días de calendario (no 168 horas): con el cambio de hora la semana dura una hora más o menos
  const nextWeekStart = addDays(weekStart, 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const recentFrom = addDays(today, -RECENT_DAYS + 1);
  const velocityFrom = addDays(weekStart, -7 * VELOCITY_WEEKS);

  const done = tasks.filter((t) => isArchived(t) && t.doneAt);
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
  const weeksElapsed = VELOCITY_WEEKS + Math.max(1, (now.getTime() - weekStart.getTime()) / DAY_MS) / 7;
  const estimatedMinutes = velocityTasks.reduce((sum, t) => sum + (t.estimateMinutes ?? 0), 0);

  const cycles = recent.map((t) => (doneMoment(t)!.getTime() - new Date(t.createdAt).getTime()) / DAY_MS).filter((d) => d >= 0);

  let streak = 0;
  for (let day = countsByDay.get(toDateString(today)) ? today : addDays(today, -1); countsByDay.get(toDateString(day)); day = addDays(day, -1)) {
    streak++;
  }

  const open = tasks.filter((t) => !isArchived(t) && !t.isSomeday);
  const areaCounts = new Map<WheelCategory, number>();
  for (const task of recent) {
    if (task.wheelCategory) areaCounts.set(task.wheelCategory, (areaCounts.get(task.wheelCategory) ?? 0) + 1);
  }

  return {
    doneToday: countsByDay.get(toDateString(today)) ?? 0,
    doneThisWeek: doneSince(weekStart).length,
    doneThisMonth: doneSince(monthStart).length,
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
    byArea: [...areaCounts.entries()].map(([area, count]) => ({ area, count })).sort((a, b) => b.count - a.count)
  };
};

export interface Recommendation {
  id: string;
  text: string;
  action?: { label: string; tab: AppTab };
}

// Recomendaciones sencillas a partir de las estadísticas (como mucho tres, de más a menos urgente)
export const recommendationsFor = (
  stats: TaskStats,
  tasks: TaskItem[],
  wheelLogs: WheelOfLifeLog[],
  now = new Date()
): Recommendation[] => {
  const list: Recommendation[] = [];
  if (stats.overdue > 0) {
    const oldest = tasks
      .filter((t) => !isArchived(t) && !t.isSomeday && dueMoment(t) && dueMoment(t)! < now)
      .sort((a, b) => dueMoment(a)!.getTime() - dueMoment(b)!.getTime())[0];
    list.push({
      id: 'overdue',
      text:
        stats.overdue === 1
          ? `Tienes una tarea vencida: «${oldest.title}». Hazla o cámbiale el plazo.`
          : `Tienes ${stats.overdue} tareas vencidas. Empieza por la más antigua: «${oldest.title}».`,
      action: { label: 'Ver la agenda', tab: 'agenda' }
    });
  }
  if (stats.dueThisWeek >= 5) {
    list.push({
      id: 'busy-week',
      text: `Esta semana vencen ${stats.dueThisWeek} tareas. Revisa si alguna puede esperar o pasar a «Quizá».`,
      action: { label: 'Ver las listas', tab: 'tasks' }
    });
  }
  if (stats.onTimeRate !== null && stats.onTime + stats.late >= 5 && stats.onTimeRate < 0.6) {
    list.push({
      id: 'late',
      text: `En el último mes terminaste a tiempo el ${Math.round(stats.onTimeRate * 100)} % de las tareas con plazo. Prueba a dividir las largas o a poner plazos más realistas.`
    });
  }
  if (stats.open > 0 && stats.doneThisWeek === 0) {
    list.push({
      id: 'restart',
      text: 'Esta semana aún no has completado ninguna tarea. Elige una corta del Top 10 y hazla hoy.',
      action: { label: 'Ver las listas', tab: 'tasks' }
    });
  }
  const lastWheel = wheelLogs[wheelLogs.length - 1];
  if (!lastWheel || now.getTime() - new Date(lastWheel.timestamp).getTime() > RECENT_DAYS * DAY_MS) {
    list.push({
      id: 'wheel',
      text: lastWheel
        ? 'Hace más de un mes que no evalúas tu Rueda de la Vida. Revisarla ayuda a elegir en qué centrarte.'
        : 'Aún no has evaluado tu Rueda de la Vida. Es el punto de partida para elegir en qué centrarte.',
      action: { label: 'Ir a la Rueda', tab: 'wheel' }
    });
  }
  return list.slice(0, 3);
};
