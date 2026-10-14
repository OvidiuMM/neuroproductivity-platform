import { TaskItem, TaskPriority, TaskStatus, WheelCategory } from '../types';
import { PRIORITY_LEVELS, TASK_STATUSES, WEEK_MS, dueMoment, effectivePriority } from './tasks';

// ESTIMACIÓN: duración estimada de la tarea, en minutos
export const ESTIMATE_OPTIONS: { value: number; label: string }[] = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 h' },
  { value: 120, label: '2 h' },
  { value: 240, label: 'Medio día (4 h)' },
  { value: 480, label: '1 día (8 h)' },
  { value: 960, label: 'Más de 1 día' }
];

export const formatEstimate = (minutes: number) =>
  ESTIMATE_OPTIONS.find((o) => o.value === minutes)?.label ??
  (minutes < 60 ? `${minutes} min` : `${Math.round((minutes / 60) * 10) / 10} h`);

// ORDEN Y FILTROS DEL TOP 10 (las 10 primeras tareas tras filtrar y ordenar)
export type SortBy = 'priority' | 'deadline' | 'estimate' | 'date' | 'category';
export type DeadlineFilter = 'ALL' | 'OVERDUE' | 'NEXT_7_DAYS' | 'WITH_DATE' | 'NO_DATE';

export interface ListFilters {
  priority: TaskPriority | 'ALL'; // prioridad efectiva
  maxEstimate: number | 'ALL'; // con filtro, las tareas sin estimación no aparecen
  status: Exclude<TaskStatus, 'DONE'> | 'ALL';
  deadline: DeadlineFilter;
  category: WheelCategory | 'ALL';
}

export interface ListPrefs {
  sortBy: SortBy;
  filters: ListFilters;
}

export const DEFAULT_LIST_PREFS: ListPrefs = {
  sortBy: 'priority',
  filters: { priority: 'ALL', maxEstimate: 'ALL', status: 'ALL', deadline: 'ALL', category: 'ALL' }
};

const FILTER_OPTIONS: { [K in keyof ListFilters]: readonly ListFilters[K][] } = {
  priority: ['ALL', ...PRIORITY_LEVELS],
  maxEstimate: ['ALL', ...ESTIMATE_OPTIONS.map((option) => option.value)],
  status: ['ALL', ...TASK_STATUSES.map((option) => option.value).filter((status) => status !== 'DONE')],
  deadline: ['ALL', 'OVERDUE', 'NEXT_7_DAYS', 'WITH_DATE', 'NO_DATE'],
  category: ['ALL', 'Salud', 'Carrera Profesional', 'Finanzas', 'Familia', 'Ocio', 'Relaciones', 'Espiritualidad']
};

export const countActiveFilters = (filters: ListFilters) =>
  Object.values(filters).filter((value) => value !== 'ALL').length;

const matchesDeadline = (task: TaskItem, filter: DeadlineFilter, now: Date) => {
  if (filter === 'ALL') return true;
  const due = dueMoment(task);
  if (filter === 'NO_DATE') return !due;
  if (!due) return false;
  if (filter === 'WITH_DATE') return true;
  const remaining = due.getTime() - now.getTime();
  if (filter === 'OVERDUE') return remaining < 0;
  return remaining >= 0 && remaining < WEEK_MS; // NEXT_7_DAYS
};

const matchesFilters = (task: TaskItem, filters: ListFilters, now: Date) =>
  (filters.priority === 'ALL' || effectivePriority(task, now) === filters.priority) &&
  (filters.maxEstimate === 'ALL' ||
    (task.estimateMinutes !== undefined && task.estimateMinutes <= filters.maxEstimate)) &&
  (filters.status === 'ALL' || task.status === filters.status) &&
  (filters.category === 'ALL' || task.wheelCategory === filters.category) &&
  matchesDeadline(task, filters.deadline, now);

const byPriorityDesc = (a: TaskItem, b: TaskItem, now: Date) =>
  PRIORITY_LEVELS.indexOf(effectivePriority(b, now)) - PRIORITY_LEVELS.indexOf(effectivePriority(a, now));
const byDueAsc = (a: TaskItem, b: TaskItem) =>
  (dueMoment(a)?.getTime() ?? Infinity) - (dueMoment(b)?.getTime() ?? Infinity);
const byUpdatedDesc = (a: TaskItem, b: TaskItem) => b.updatedAt.localeCompare(a.updatedAt);
const byEstimateAsc = (a: TaskItem, b: TaskItem) => (a.estimateMinutes ?? Infinity) - (b.estimateMinutes ?? Infinity);
// Las tareas sin área van al final (un carácter centinela no sirve: localeCompare no lo ordena el último)
const byCategoryAsc = (a: TaskItem, b: TaskItem) => {
  if (a.wheelCategory && b.wheelCategory) return a.wheelCategory.localeCompare(b.wheelCategory, 'es');
  return (a.wheelCategory ? 0 : 1) - (b.wheelCategory ? 0 : 1);
};

// Cada criterio desempata con los siguientes; lo que no tiene fecha o estimación va al final
const COMPARATORS: Record<SortBy, (a: TaskItem, b: TaskItem, now: Date) => number> = {
  priority: (a, b, now) => byPriorityDesc(a, b, now) || byDueAsc(a, b) || byUpdatedDesc(a, b),
  deadline: (a, b, now) => byDueAsc(a, b) || byPriorityDesc(a, b, now) || byUpdatedDesc(a, b),
  estimate: (a, b, now) => byEstimateAsc(a, b) || byPriorityDesc(a, b, now) || byDueAsc(a, b),
  date: (a, b) => byUpdatedDesc(a, b),
  category: (a, b, now) => byCategoryAsc(a, b) || byPriorityDesc(a, b, now)
};

export const arrangeTasks = (tasks: TaskItem[], prefs: ListPrefs, now = new Date()) =>
  tasks.filter((t) => matchesFilters(t, prefs.filters, now)).sort((a, b) => COMPARATORS[prefs.sortBy](a, b, now));

// Preferencias guardadas en este dispositivo; los valores desconocidos vuelven a los de por defecto
export const parseListPrefs = (raw: string | null): ListPrefs => {
  try {
    const stored = (raw ? JSON.parse(raw) : {}) as { sortBy?: unknown; filters?: Record<string, unknown> };
    const filterValue = <K extends keyof ListFilters>(key: K): ListFilters[K] => {
      const value = stored.filters?.[key];
      const options: readonly unknown[] = FILTER_OPTIONS[key];
      return options.includes(value) ? (value as ListFilters[K]) : DEFAULT_LIST_PREFS.filters[key];
    };
    return {
      sortBy:
        typeof stored.sortBy === 'string' && Object.prototype.hasOwnProperty.call(COMPARATORS, stored.sortBy)
          ? (stored.sortBy as ListPrefs['sortBy'])
          : DEFAULT_LIST_PREFS.sortBy,
      filters: {
        priority: filterValue('priority'),
        maxEstimate: filterValue('maxEstimate'),
        status: filterValue('status'),
        deadline: filterValue('deadline'),
        category: filterValue('category')
      }
    };
  } catch {
    return DEFAULT_LIST_PREFS;
  }
};
