import { ListContext, MeetingGuard, TaskItem } from '../types';
import { DeadlineState, getDeadlineState, isArchived, toLocalDate } from './tasks';
import { occurrencesBetween, toDateString } from './recurrence';

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
export const startOfWeek = (d: Date) =>
  addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));

// Días (YYYY-MM-DD) desde `start` incluido durante `count` días
export const daysFrom = (start: Date, count: number) =>
  Array.from({ length: count }, (_, i) => toDateString(addDays(start, i)));

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
    if (isArchived(task) || !task.dueDate) continue;
    const base = { title: task.title, context: task.listContext, task, deadline: getDeadlineState(task, now) };

    // Una tarea repetida no es un intervalo: cada repetición ocupa solo su día
    if (task.startDate && task.startDate < task.dueDate && !task.recurrence) {
      // Intervalo: empieza, días en curso y vence. Solo se recorre la parte visible, dure lo que dure.
      const from = task.startDate > first ? task.startDate : first;
      const to = task.dueDate < last ? task.dueDate : last;
      for (let d = toLocalDate(from); toDateString(d) <= to; d = addDays(d, 1)) {
        const date = toDateString(d);
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

    // Repeticiones previstas (las crea la app al completar cada una; aquí solo se anticipan). Solo desde la
    // última tarea de la serie: una repetición reactivada ya tiene sucesora, que proyecta las mismas fechas.
    if (task.recurrence && !task.nextOccurrenceId) {
      for (const date of occurrencesBetween(task.dueDate, task.recurrence, first, last)) {
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
    .filter((t) => !isArchived(t) && getDeadlineState(t, now) === 'overdue')
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
