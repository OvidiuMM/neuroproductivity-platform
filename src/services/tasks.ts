import { TaskItem, TaskPriority, TaskStatus } from '../types';
import { LOCALE_TAG, messages } from '../i18n/locale';

const m = messages(
  {
    status: {
      PENDING: 'Pendiente',
      IN_PROGRESS: 'En progreso',
      BLOCKED: 'Bloqueada',
      DONE: 'Hecha',
      CANCELLED: 'Cancelada'
    },
    priority: { CRITICAL: 'Crítica', HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' },
    due: (date: string) => `Vence: ${date}`,
    rangeWithoutDue: 'Para un intervalo indica también la fecha límite.',
    startAfterDue: 'La fecha de inicio no puede ser posterior a la fecha límite.'
  },
  {
    status: {
      PENDING: 'Pending',
      IN_PROGRESS: 'In progress',
      BLOCKED: 'Blocked',
      DONE: 'Done',
      CANCELLED: 'Canceled'
    },
    priority: { CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' },
    due: (date) => `Due: ${date}`,
    rangeWithoutDue: 'For a date range, also set the due date.',
    startAfterDue: "The start date can't be after the due date."
  }
);

export const TASK_STATUSES: { value: TaskStatus; label: string; className: string }[] = [
  { value: 'PENDING', label: m.status.PENDING, className: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'IN_PROGRESS', label: m.status.IN_PROGRESS, className: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'BLOCKED', label: m.status.BLOCKED, className: 'bg-amber-50 text-amber-800 border-amber-200' },
  { value: 'DONE', label: m.status.DONE, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'CANCELLED', label: m.status.CANCELLED, className: 'bg-zinc-100 text-zinc-700 border-zinc-300' }
];

export const PRIORITY_LABEL: Record<TaskPriority, string> = m.priority;

export const statusLabel = (status: TaskStatus) => TASK_STATUSES.find((s) => s.value === status)?.label ?? status;

// Las tareas guardadas antes de la 0.6.0 tienen `completed` en lugar de `status`
type StoredTask = Omit<TaskItem, 'status'> & { status?: TaskStatus; completed?: boolean };

export const normalizeTask = ({ completed, ...task }: StoredTask): TaskItem => ({
  ...task,
  status: task.status ?? (completed ? 'DONE' : 'PENDING')
});

// Hecha y Cancelada archivan la tarea. Una cancelada no cuenta como hecha: ni en las estadísticas ni en el avance
export type ArchivedStatus = Extract<TaskStatus, 'DONE' | 'CANCELLED'>;
export const isArchivedStatus = (status: TaskStatus): status is ArchivedStatus =>
  status === 'DONE' || status === 'CANCELLED';
export const isArchived = (task: Pick<TaskItem, 'status'>) => isArchivedStatus(task.status);
export const isDone = (task: Pick<TaskItem, 'status'>) => task.status === 'DONE';
export const isCancelled = (task: Pick<TaskItem, 'status'>) => task.status === 'CANCELLED';

// Cambiar a Hecha o Cancelada archiva la tarea (con la fecha en doneAt); cualquier otro estado la reactiva
export const withStatus = (task: TaskItem, status: TaskStatus, now = new Date()): TaskItem => {
  const { doneAt: _previousDoneAt, ...rest } = task;
  return {
    ...rest,
    status,
    ...(isArchivedStatus(status) ? { doneAt: now.toISOString() } : {}),
    updatedAt: now.toISOString()
  };
};

// Si las tareas siguen tal como se escribieron (nadie las ha tocado desde entonces, aquí o en otro dispositivo)
export const isUnchanged = (written: TaskItem[], current: TaskItem[]) =>
  written.every((w) => current.some((t) => t.id === w.id && t.updatedAt === w.updatedAt && t.status === w.status));

// FECHAS: cadenas locales (YYYY-MM-DD y HH:mm) interpretadas en la zona horaria del dispositivo
export const toLocalDate = (date: string, time?: string) => {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time ?? '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
};

// Sin hora, el plazo vence al final del día
export const dueMoment = (task: Pick<TaskItem, 'dueDate' | 'dueTime'>): Date | null => {
  if (!task.dueDate) return null;
  if (task.dueTime) return toLocalDate(task.dueDate, task.dueTime);
  const endOfDay = toLocalDate(task.dueDate);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay;
};

export type DeadlineState = 'overdue' | 'today' | 'soon' | 'normal' | 'none';

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Vencida: título en rojo. Vence hoy (y aún no ha vencido): violeta oscuro, en negrita y con la etiqueta «Hoy». Vence
// en menos de una semana: violeta. Las tareas hechas no se colorean.
export const getDeadlineState = (task: TaskItem, now = new Date()): DeadlineState => {
  if (isArchived(task)) return 'none';
  const due = dueMoment(task);
  if (!due) return 'none';
  const remaining = due.getTime() - now.getTime();
  if (remaining < 0) return 'overdue';
  if (due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth() && due.getDate() === now.getDate())
    return 'today';
  if (remaining < WEEK_MS) return 'soon';
  return 'normal';
};

// PRIORIDAD EFECTIVA: con la fecha límite a más de una semana, la tarea cuenta un nivel por debajo
// (Crítica → Alta → Media → Baja). Sin fecha límite mantiene su prioridad.
export const PRIORITY_LEVELS: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const effectivePriority = (
  task: Pick<TaskItem, 'priority' | 'dueDate' | 'dueTime'>,
  now = new Date()
): TaskPriority => {
  const due = dueMoment(task);
  if (!due || due.getTime() - now.getTime() <= WEEK_MS) return task.priority;
  return PRIORITY_LEVELS[Math.max(0, PRIORITY_LEVELS.indexOf(task.priority) - 1)];
};

// El color del título según el plazo (las que vencen hoy, además, en negrita: lo decide cada vista)
export const DEADLINE_TITLE_CLASS: Record<DeadlineState, string> = {
  overdue: 'text-red-600',
  today: 'text-violet-800',
  soon: 'text-violet-600',
  normal: '',
  none: ''
};

const dateFormat = new Intl.DateTimeFormat(LOCALE_TAG, { day: 'numeric', month: 'short', year: 'numeric' });

// Día en formato corto y legible (p. ej. «13 oct 2026»)
export const formatDay = (date: string) => dateFormat.format(toLocalDate(date));

const formatPoint = (date: string, time?: string) =>
  `${dateFormat.format(toLocalDate(date))}${time ? `, ${time}` : ''}`;

// Una tarea repetida nunca es un intervalo: cada repetición vence su día (las de antes de 0.8 podían tener inicio)
export const formatTaskDates = (
  task: Pick<TaskItem, 'startDate' | 'startTime' | 'dueDate' | 'dueTime' | 'recurrence'>
) => {
  if (!task.dueDate) return null;
  const due = formatPoint(task.dueDate, task.dueTime);
  return task.startDate && !task.recurrence ? `${formatPoint(task.startDate, task.startTime)} → ${due}` : m.due(due);
};

export const validateTaskDates = (
  task: Pick<TaskItem, 'startDate' | 'startTime' | 'dueDate' | 'dueTime'>
): string | null => {
  if (task.startDate && !task.dueDate) return m.rangeWithoutDue;
  if (task.startDate && task.dueDate) {
    const start = toLocalDate(task.startDate, task.startTime);
    const due = dueMoment(task)!;
    if (start.getTime() > due.getTime()) return m.startAfterDue;
  }
  return null;
};
