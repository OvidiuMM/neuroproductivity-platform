import { TaskItem, TaskPriority, TaskStatus } from '../types';

export const TASK_STATUSES: { value: TaskStatus; label: string; className: string }[] = [
  { value: 'PENDING', label: 'Pendiente', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'IN_PROGRESS', label: 'En progreso', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'BLOCKED', label: 'Bloqueada', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  { value: 'DONE', label: 'Hecha', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'CANCELLED', label: 'Cancelada', className: 'bg-zinc-100 text-zinc-700 border-zinc-300' }
];

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  CRITICAL: 'Crítica',
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja'
};

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

export type DeadlineState = 'overdue' | 'soon' | 'normal' | 'none';

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Vencida: título en rojo. Vence en menos de una semana: título en violeta. Las tareas hechas no se colorean.
export const getDeadlineState = (task: TaskItem, now = new Date()): DeadlineState => {
  if (isArchived(task)) return 'none';
  const due = dueMoment(task);
  if (!due) return 'none';
  const remaining = due.getTime() - now.getTime();
  if (remaining < 0) return 'overdue';
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

export const DEADLINE_TITLE_CLASS: Record<DeadlineState, string> = {
  overdue: 'text-red-600',
  soon: 'text-violet-600',
  normal: '',
  none: ''
};

const dateFormat = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

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
  return task.startDate && !task.recurrence
    ? `${formatPoint(task.startDate, task.startTime)} → ${due}`
    : `Vence: ${due}`;
};

export const validateTaskDates = (
  task: Pick<TaskItem, 'startDate' | 'startTime' | 'dueDate' | 'dueTime'>
): string | null => {
  if (task.startDate && !task.dueDate) return 'Para un intervalo indica también la fecha límite.';
  if (task.startDate && task.dueDate) {
    const start = toLocalDate(task.startDate, task.startTime);
    const due = dueMoment(task)!;
    if (start.getTime() > due.getTime()) return 'La fecha de inicio no puede ser posterior a la fecha límite.';
  }
  return null;
};
