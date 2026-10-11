import { ListContext, MeetingGuard, TaskItem } from '../types';
import { DeadlineState, getDeadlineState, toLocalDate } from './tasks';
import { toDateString, upcomingOccurrences } from './recurrence';

// Elemento de la agenda en un día concreto
export interface AgendaItem {
  key: string;
  kind: 'task' | 'occurrence' | 'meeting';
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm (sin hora: todo el día)
  endTime?: string;
  // task: vence / empieza / en curso (intervalo) · occurrence: repetición prevista de una tarea recurrente
  label: 'Vence' | 'Empieza' | 'En curso' | 'Repetición prevista' | 'Reunión';
  context?: ListContext;
  deadline: DeadlineState;
  task?: TaskItem;
}

const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
const pad = (n: number) => String(n).padStart(2, '0');
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Lunes de la semana de una fecha
export const startOfWeek = (d: Date) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));

// Días (YYYY-MM-DD) desde `start` incluido durante `count` días
export const daysFrom = (start: Date, count: number) => Array.from({ length: count }, (_, i) => toDateString(addDays(start, i)));

// Máximo de repeticiones previstas que se proyectan por tarea (suficiente para varias semanas de una tarea diaria)
const MAX_PROJECTED = 120;

// Agrupa por día las tareas activas con fecha (plazos, intervalos y repeticiones previstas) y las reuniones
export const buildAgenda = (
  tasks: TaskItem[],
  meetings: MeetingGuard[],
  days: string[],
  now = new Date()
): Map<string, AgendaItem[]> => {
  const agenda = new Map<string, AgendaItem[]>(days.map((d) => [d, []]));
  const first = days[0];
  const last = days[days.length - 1];
  const add = (item: AgendaItem) => agenda.get(item.date)?.push(item);

  for (const task of tasks) {
    if (task.status === 'DONE' || !task.dueDate) continue;
    const base = { title: task.title, context: task.listContext, task, deadline: getDeadlineState(task, now) };

    if (task.startDate && task.startDate < task.dueDate) {
      // Intervalo: empieza, días en curso y vence
      for (let d = toLocalDate(task.startDate), i = 0; toDateString(d) <= task.dueDate && i < 400; d = addDays(d, 1), i++) {
        const date = toDateString(d);
        if (date < first || date > last) continue;
        const label = date === task.startDate ? 'Empieza' : date === task.dueDate ? 'Vence' : 'En curso';
        add({
          ...base,
          key: `${task.id}:${date}`,
          kind: 'task',
          date,
          label,
          time: label === 'Empieza' ? task.startTime : label === 'Vence' ? task.dueTime : undefined
        });
      }
    } else {
      add({ ...base, key: task.id, kind: 'task', date: task.dueDate, time: task.dueTime, label: 'Vence' });
    }

    // Repeticiones previstas (las crea la app al completar cada una; aquí solo se anticipan)
    if (task.recurrence) {
      for (const date of upcomingOccurrences(task.dueDate, task.recurrence, MAX_PROJECTED).slice(1)) {
        if (date > last) break;
        if (date < first) continue;
        add({
          ...base,
          deadline: 'none',
          key: `${task.id}:next:${date}`,
          kind: 'occurrence',
          date,
          time: task.dueTime,
          label: 'Repetición prevista'
        });
      }
    }
  }

  for (const meeting of meetings) {
    const start = new Date(meeting.startTime);
    const end = new Date(meeting.endTime);
    add({
      key: meeting.id,
      kind: 'meeting',
      title: meeting.title,
      date: toDateString(start),
      time: localTime(start),
      endTime: localTime(end),
      label: 'Reunión',
      deadline: 'none'
    });
  }

  // Dentro de cada día: primero lo que no tiene hora, después por hora
  for (const items of agenda.values()) {
    items.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title));
  }
  return agenda;
};

// Tareas activas cuya fecha límite ya pasó (se muestran aparte en la vista por días)
export const overdueTasks = (tasks: TaskItem[], now = new Date()) =>
  tasks
    .filter((t) => t.status !== 'DONE' && getDeadlineState(t, now) === 'overdue')
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
