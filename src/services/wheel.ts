import type { DefaultWheelCategory, WheelArea, WheelCategory } from '../types';

// Áreas de partida de la Rueda de la Vida, en el orden en que se muestran (son también sus identificadores)
export const WHEEL_CATEGORIES: DefaultWheelCategory[] = [
  'Salud',
  'Carrera Profesional',
  'Finanzas',
  'Familia',
  'Ocio',
  'Relaciones',
  'Espiritualidad'
];

// ÁREAS DE CADA CUENTA: renombrar, ocultar y añadir. Se guardan en el perfil (wheelAreas); sin nada guardado, las 7
// de partida
export const DEFAULT_AREAS: WheelArea[] = WHEEL_CATEGORIES.map((id) => ({ id, label: id }));
export const AREA_LABEL_MAX = 30;
export const MIN_VISIBLE_AREAS = 3; // con menos, el gráfico de la Rueda no se puede dibujar
export const MAX_VISIBLE_AREAS = 12;

// Las áreas guardadas, o las de partida si no hay ninguna válida (descarta entradas raras y repetidas)
export const resolveAreas = (stored: unknown): WheelArea[] => {
  if (!Array.isArray(stored)) return DEFAULT_AREAS;
  const seen = new Set<string>();
  const areas: WheelArea[] = [];
  for (const entry of stored as unknown[]) {
    if (!entry || typeof entry !== 'object') continue;
    const { id, label, hidden } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || !id || seen.has(id) || typeof label !== 'string' || !label.trim()) continue;
    seen.add(id);
    areas.push(hidden === true ? { id, label: label.trim(), hidden: true } : { id, label: label.trim() });
  }
  return areas.some((a) => !a.hidden) ? areas : DEFAULT_AREAS;
};

export const visibleAreas = (areas: WheelArea[]) => areas.filter((a) => !a.hidden);

// El nombre que se muestra; un área que ya no está en la lista conserva su identificador como nombre
export const areaLabel = (areas: WheelArea[], id: WheelCategory | undefined) =>
  id ? (areas.find((a) => a.id === id)?.label ?? id) : '';

// Áreas para elegir: las visibles y, aunque esté oculta (o ya no exista), la elegida
export const selectableAreas = (areas: WheelArea[], current?: WheelCategory): WheelArea[] => {
  const list = areas.filter((a) => !a.hidden || a.id === current);
  return current && !areas.some((a) => a.id === current) ? [...list, { id: current, label: current }] : list;
};

export const newAreaId = () => `area-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Las áreas en uso (p. ej. las de unas metas), en el orden de la cuenta; las que ya no existen, al final
export const areasInUse = (areas: WheelArea[], used: WheelCategory[]) => {
  const set = new Set(used);
  const ordered = areas.map((a) => a.id).filter((id) => set.has(id));
  for (const id of set) if (!ordered.includes(id)) ordered.push(id);
  return ordered;
};

// Un identificador de área: una de partida o una añadida (area-…)
export const isAreaId = (value: unknown): value is WheelCategory =>
  typeof value === 'string' &&
  ((WHEEL_CATEGORIES as readonly string[]).includes(value) || /^area-[a-z0-9]+$/.test(value));

// Nombres no vacíos, cortos y distintos, y entre 3 y 12 áreas visibles
export const validateAreas = (areas: WheelArea[]): string | null => {
  if (areas.some((a) => !a.label.trim())) return 'Cada área necesita un nombre.';
  if (areas.some((a) => a.label.trim().length > AREA_LABEL_MAX))
    return `Los nombres no pueden pasar de ${AREA_LABEL_MAX} caracteres.`;
  const names = areas.map((a) => a.label.trim().toLocaleLowerCase('es'));
  if (new Set(names).size !== names.length) return 'Dos áreas no pueden llamarse igual.';
  const visible = visibleAreas(areas).length;
  if (visible < MIN_VISIBLE_AREAS) return `Deja al menos ${MIN_VISIBLE_AREAS} áreas a la vista.`;
  if (visible > MAX_VISIBLE_AREAS) return `Puedes tener hasta ${MAX_VISIBLE_AREAS} áreas a la vista.`;
  return null;
};

// Media de una evaluación: de las áreas que puntuó (una evaluación antigua no tiene las áreas añadidas después)
export const logAverage = (scores: Record<string, number>) => {
  const values = Object.values(scores).filter((v) => typeof v === 'number');
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
};
