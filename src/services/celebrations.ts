import type { Goal, GoalStatus, Project, ProjectStatus, TaskItem, TaskStatus } from '../types';
import { isArchivedStatus } from './tasks';

// CELEBRACIONES: un mensaje (y, en App.tsx, una breve animación) cuando, en esta pestaña, se hace una tarea que
// llevaba tiempo en la lista, se logra una meta o se termina un proyecto. Nunca al cancelar, eliminar, archivar,
// reactivar, deshacer o importar, ni por cambios que llegan de otras pestañas o dispositivos: solo se pregunta desde
// los manejadores de lo que hace la persona.

// Una tarea cuenta como antigua con 14 días o más desde que se creó (14 × 24 h)
export const OLD_TASK_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export type CelebrationKind = 'oldTask' | 'goal' | 'project';

// Lo que acaba de pasar: qué cambia, de qué estado (el del elemento) a cuál
export type CelebrationTrigger =
  | {
      type: 'task';
      task: Pick<TaskItem, 'id' | 'status' | 'createdAt' | 'recurrence'>;
      to: TaskStatus;
      now?: Date;
    }
  | { type: 'goal'; goal: Pick<Goal, 'id' | 'status'>; to: GoalStatus }
  | { type: 'project'; project: Pick<Project, 'id' | 'status'>; to: ProjectStatus };

export interface Celebration {
  message: string;
}

// Mensajes de cada tipo. En los de las tareas, {days} son los días que llevaba en la lista (siempre 14 o más)
export const CELEBRATION_MESSAGES: Record<CelebrationKind, readonly string[]> = {
  oldTask: [
    'Llevaba {days} días en tu lista. Ya no.',
    '{days} días después, hecha. Una cosa menos en la cabeza.',
    'Esta tarea te acompañaba desde hace {days} días. Ya puedes soltarla.',
    'Las tareas que llevan tiempo esperando pesan más. Acabas de quitarte una de encima.',
    'Ha costado, pero está hecha. Eso es lo que cuenta.',
    'Cerrar algo pendiente desde hace {days} días libera más espacio del que parece.',
    'Hay tareas que se resisten. Esta ya no.',
    'Lo que llevabas {days} días aplazando ya es pasado.',
    'Retomar lo pendiente cuesta más que empezar algo nuevo, y lo has hecho.',
    'Una tarea antigua menos: tu lista respira mejor.',
    '{days} días en espera y hoy la has terminado. Buen trabajo.',
    'Volver a lo que se quedó atrás también es avanzar.',
    'Has cerrado un asunto de hace {days} días. Disfruta la sensación.',
    'No importa cuánto haya tardado: hoy está hecha.'
  ],
  goal: [
    'Te lo propusiste y lo has conseguido.',
    'Tómate un momento para notarlo: esto lo has construido tú.',
    'Empezó como una intención y ahora es un hecho.',
    'Cada tarea que hiciste por esta meta ha valido la pena.',
    'Paso a paso, has llegado. Enhorabuena.',
    'Has convertido un objetivo en un resultado.',
    'Esto demuestra que tu forma de avanzar funciona.',
    'Recuerda este momento la próxima vez que una meta te parezca lejana.',
    'Un área de tu Rueda, un poco más cerca de donde la quieres.',
    'La constancia ha dado su fruto. Disfrútalo.',
    'Has cumplido lo que te prometiste. Eso dice mucho de ti.',
    'Buen momento para mirar atrás y ver todo lo que has avanzado.',
    'Lo que hace un tiempo era un plan ya es algo conseguido.',
    'Querer algo y lograrlo: así se ve el progreso.'
  ],
  project: [
    'Todas sus piezas están en su sitio. Buen trabajo.',
    'Un proyecto terminado es mucho trabajo bien hecho. Enhorabuena.',
    'De la primera tarea a la última: lo has llevado hasta el final.',
    'Terminar es lo más difícil, y lo has hecho.',
    'Tu meta está ahora más cerca gracias a este proyecto.',
    'Muchas tareas pequeñas, un resultado grande.',
    'Has llevado este proyecto de la idea a la realidad.',
    'Tómate un respiro: te lo has ganado.',
    'Cerrar un proyecto deja sitio para lo siguiente.',
    'Lo que empezó como un plan ahora está hecho.',
    'Acabar lo que empiezas es una habilidad, y la tienes.',
    'Mira atrás un momento: todo esto lo has hecho tú.',
    'Un frente abierto menos. Disfruta de la calma.',
    'De principio a fin, este proyecto es tuyo.'
  ]
};

// Días enteros desde que se creó la tarea; null si la fecha no se entiende
export const taskAgeDays = (createdAt: string, now: Date): number | null => {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return null;
  return Math.floor((now.getTime() - created) / DAY_MS);
};

// Si el cambio merece celebración, de qué tipo (con los días, en una tarea). Una tarea, solo al hacerla desde un estado
// abierto (no al pasar de Cancelada a Hecha en «Archivadas») y si no se repite: cada repetición es nueva. Una meta, al
// lograrla estando activa; un proyecto, al terminarlo estando activo.
export const celebrationKind = (trigger: CelebrationTrigger): { kind: CelebrationKind; days?: number } | null => {
  switch (trigger.type) {
    case 'task': {
      const { task, to } = trigger;
      if (to !== 'DONE' || isArchivedStatus(task.status) || task.recurrence) return null;
      const days = taskAgeDays(task.createdAt, trigger.now ?? new Date());
      return days !== null && days >= OLD_TASK_DAYS ? { kind: 'oldTask', days } : null;
    }
    case 'goal':
      return trigger.goal.status === 'ACTIVE' && trigger.to === 'ACHIEVED' ? { kind: 'goal' } : null;
    case 'project':
      return trigger.project.status === 'ACTIVE' && trigger.to === 'FINISHED' ? { kind: 'project' } : null;
  }
};

// Elige al azar uno de `count` mensajes sin repetir el último (`last`), si hay más de uno. `random` devuelve un número
// en [0, 1), como Math.random
export const pickIndex = (count: number, last: number | undefined, random: () => number): number => {
  const avoid = last !== undefined && last >= 0 && last < count && count > 1;
  const options = avoid ? count - 1 : count;
  const index = Math.min(options - 1, Math.floor(random() * options));
  return avoid && index >= last ? index + 1 : index;
};

export const fillMessage = (template: string, days?: number) =>
  days === undefined ? template : template.replaceAll('{days}', String(days));

const elementId = (trigger: CelebrationTrigger) =>
  trigger.type === 'task' ? trigger.task.id : trigger.type === 'goal' ? trigger.goal.id : trigger.project.id;

// Celebraciones de una sesión (una pestaña): recuerda el último mensaje de cada tipo, para no repetirlo seguido, y lo ya
// celebrado, para no celebrar dos veces lo mismo (p. ej. hecha → «Deshacer» → hecha otra vez). `random`, para las pruebas
export const createCelebrations = (random: () => number = Math.random) => {
  const lastShown: Partial<Record<CelebrationKind, number>> = {};
  const celebrated = new Set<string>();
  return (trigger: CelebrationTrigger): Celebration | null => {
    const found = celebrationKind(trigger);
    if (!found) return null;
    const key = `${trigger.type}:${elementId(trigger)}`;
    if (celebrated.has(key)) return null;
    celebrated.add(key);
    const messages = CELEBRATION_MESSAGES[found.kind];
    const index = pickIndex(messages.length, lastShown[found.kind], random);
    lastShown[found.kind] = index;
    return { message: fillMessage(messages[index], found.days) };
  };
};
