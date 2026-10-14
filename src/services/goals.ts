import type { Goal, TaskItem, WheelCategory } from '../types';

export const GOAL_TITLE_MAX = 100;
export const GOAL_WHY_MAX = 280;

// Progreso de una meta: tareas vinculadas hechas sobre el total (las archivadas cuentan como hechas)
export const goalProgress = (goal: Pick<Goal, 'id'>, tasks: TaskItem[]) => {
  const linked = tasks.filter((t) => t.goalId === goal.id);
  return { done: linked.filter((t) => t.status === 'DONE').length, total: linked.length };
};

// El área de una tarea vinculada es la de su meta: se resuelve al leer, así cambiar el área de una meta no tiene que
// reescribir sus tareas (ni puede dejar alguna atrás). Un vínculo a una meta que ya no existe se ignora.
export const applyGoalAreas = (tasks: TaskItem[], goals: Goal[]) => {
  const areaOf = new Map(goals.map((g) => [g.id, g.area]));
  return tasks.map((task) => {
    const area = task.goalId ? areaOf.get(task.goalId) : undefined;
    return area && area !== task.wheelCategory ? { ...task, wheelCategory: area } : task;
  });
};

// Metas activas por área de la Rueda
export const activeGoalsByArea = (goals: Goal[]) =>
  goals
    .filter((g) => g.status === 'ACTIVE')
    .reduce<Partial<Record<WheelCategory, number>>>((acc, g) => ({ ...acc, [g.area]: (acc[g.area] ?? 0) + 1 }), {});

// Palabras con significado: sin tildes, en minúscula y de cuatro letras o más (fuera artículos y nexos)
const STOPWORDS = new Set(['para', 'como', 'desde', 'hasta', 'sobre', 'entre', 'este', 'esta', 'estos', 'estas']);
const significantWords = (text: string) =>
  new Set(
    text
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
  );

// Meta activa que más palabras comparte con el título de la tarea (al menos una); en empate, la más reciente
export const suggestGoal = (title: string, goals: Goal[]): Goal | null => {
  const words = significantWords(title);
  if (words.size === 0) return null;
  let best: { goal: Goal; shared: number } | null = null;
  for (const goal of goals) {
    if (goal.status !== 'ACTIVE') continue;
    const shared = [...significantWords(`${goal.title} ${goal.why ?? ''}`)].filter((w) => words.has(w)).length;
    if (shared === 0) continue;
    if (!best || shared > best.shared || (shared === best.shared && goal.updatedAt > best.goal.updatedAt)) {
      best = { goal, shared };
    }
  }
  return best?.goal ?? null;
};

export interface GoalDraft {
  title: string;
  area?: WheelCategory;
  why?: string;
  targetDate?: string;
}

// Lo que impide guardar la meta, o null si está bien
export const validateGoal = ({ title, area, why, targetDate }: GoalDraft): string | null => {
  if (!title.trim()) return 'Ponle un nombre a la meta.';
  if (title.trim().length > GOAL_TITLE_MAX) return `El nombre admite hasta ${GOAL_TITLE_MAX} caracteres.`;
  if (!area) return 'Elige el área de la Rueda a la que pertenece.';
  if (why && why.trim().length > GOAL_WHY_MAX) return `El «para qué» admite hasta ${GOAL_WHY_MAX} caracteres.`;
  if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return 'La fecha objetivo no es válida.';
  return null;
};

// Activas primero (por fecha objetivo, las que no tienen al final), después logradas y archivadas
const STATUS_ORDER: Record<Goal['status'], number> = { ACTIVE: 0, ACHIEVED: 1, ARCHIVED: 2 };
export const sortGoals = (goals: Goal[]) =>
  [...goals].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999') ||
      a.title.localeCompare(b.title, 'es')
  );
