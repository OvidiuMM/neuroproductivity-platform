import type { TaskItem } from '../types';
import { isArchived } from './tasks';

// TAREAS DEPENDIENTES: una tarea puede esperar a otra (dependsOn, una sola). Mientras esa siga abierta, esta está
// bloqueada: no entra en el Top 10 ni se puede marcar como hecha o en progreso. Al hacerse o cancelarse la otra, se
// desbloquea sola. Varias tareas pueden esperar a la misma y avanzar en paralelo. Una tarea que ya no existe no
// bloquea (y al restaurarla con «Deshacer», vuelve a hacerlo).

export const tasksById = (tasks: TaskItem[]) => new Map(tasks.map((task) => [task.id, task]));

// La tarea que bloquea a esta, si sigue abierta
export const blockerOf = (task: Pick<TaskItem, 'dependsOn'>, byId: Map<string, TaskItem>) => {
  const blocker = task.dependsOn ? byId.get(task.dependsOn) : undefined;
  return blocker && !isArchived(blocker) ? blocker : undefined;
};

// Las tareas abiertas que esperan a esta
export const dependentsOf = (task: Pick<TaskItem, 'id'>, tasks: TaskItem[]) =>
  tasks.filter((t) => t.dependsOn === task.id && !isArchived(t));

// ¿Que `taskId` espere a `candidateId` cerraría un ciclo? Sí si `taskId` ya está en la cadena de la que espera el
// candidato (A espera a B y B espera a A nunca se desbloquearían)
export const createsCycle = (taskId: string | undefined, candidateId: string, byId: Map<string, TaskItem>) => {
  if (!taskId) return false;
  const seen = new Set<string>();
  for (let id: string | undefined = candidateId; id && !seen.has(id); id = byId.get(id)?.dependsOn) {
    if (id === taskId) return true;
    seen.add(id);
  }
  return false;
};

// Tareas a las que puede esperar una: las abiertas, salvo ella misma y las que ya esperan a ella (directa o
// indirectamente), por título
export const dependencyCandidates = (taskId: string | undefined, tasks: TaskItem[]) => {
  const byId = tasksById(tasks);
  return tasks
    .filter((t) => !isArchived(t) && t.id !== taskId && !createsCycle(taskId, t.id, byId))
    .sort((a, b) => a.title.localeCompare(b.title, 'es'));
};
