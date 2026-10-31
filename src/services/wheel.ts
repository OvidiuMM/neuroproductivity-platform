import type { DefaultWheelCategory, WheelArea, WheelCategory } from '../types';
import { LOCALE_TAG, messages, type Locale } from '../i18n/locale';

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

// Nombre de las áreas de partida en cada idioma (en español, su identificador). Se guardan con su identificador como
// nombre; al leerlas, un área de partida guardada con su identificador se muestra con el nombre del idioma de la app.
// Las renombradas conservan su nombre (también si coincide con el de partida del otro idioma).
const DEFAULT_AREA_NAMES: Record<Locale, Record<DefaultWheelCategory, string>> = {
  es: {
    Salud: 'Salud',
    'Carrera Profesional': 'Carrera Profesional',
    Finanzas: 'Finanzas',
    Familia: 'Familia',
    Ocio: 'Ocio',
    Relaciones: 'Relaciones',
    Espiritualidad: 'Espiritualidad'
  },
  en: {
    Salud: 'Health',
    'Carrera Profesional': 'Career',
    Finanzas: 'Finances',
    Familia: 'Family',
    Ocio: 'Leisure',
    Relaciones: 'Relationships',
    Espiritualidad: 'Spirituality'
  }
};
const areaNames = messages(DEFAULT_AREA_NAMES.es, DEFAULT_AREA_NAMES.en);

const isDefaultCategory = (id: string): id is DefaultWheelCategory =>
  (WHEEL_CATEGORIES as readonly string[]).includes(id);

// El nombre de partida de un área en el idioma de la app; el de un área añadida es su identificador
export const defaultAreaLabel = (id: WheelCategory) => (isDefaultCategory(id) ? areaNames[id] : id);

// Un área de partida sin renombrar se guarda con su identificador como nombre (que es su nombre en español, como antes
// de 1.2.0): se muestra con el nombre de partida del idioma de la app. Cualquier otro nombre es de la persona, aunque
// coincida con el de partida del otro idioma
const isUnrenamed = (id: string, label: string) => isDefaultCategory(id) && label === id;

// ÁREAS DE CADA CUENTA: renombrar, ocultar y añadir. Se guardan en el perfil (wheelAreas); sin nada guardado, las 7
// de partida
export const DEFAULT_AREAS: WheelArea[] = WHEEL_CATEGORIES.map((id) => ({ id, label: defaultAreaLabel(id) }));
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
    const name = isUnrenamed(id, label.trim()) ? defaultAreaLabel(id) : label.trim();
    areas.push(hidden === true ? { id, label: name, hidden: true } : { id, label: name });
  }
  return areas.some((a) => !a.hidden) ? areas : DEFAULT_AREAS;
};

// Lo que se guarda: un área de partida con su nombre de partida en el idioma de la app, con su identificador como
// nombre (así se ve en el idioma que se use después)
export const storableAreas = (areas: WheelArea[]): WheelArea[] =>
  areas.map((a) =>
    isDefaultCategory(a.id) && a.label === defaultAreaLabel(a.id) && a.label !== a.id ? { ...a, label: a.id } : a
  );

export const visibleAreas = (areas: WheelArea[]) => areas.filter((a) => !a.hidden);

// El nombre que se muestra; un área que ya no está en la lista conserva su identificador como nombre (el de partida,
// en el idioma de la app)
export const areaLabel = (areas: WheelArea[], id: WheelCategory | undefined) =>
  id ? (areas.find((a) => a.id === id)?.label ?? defaultAreaLabel(id)) : '';

// Áreas para elegir: las visibles y, aunque esté oculta (o ya no exista), la elegida
export const selectableAreas = (areas: WheelArea[], current?: WheelCategory): WheelArea[] => {
  const list = areas.filter((a) => !a.hidden || a.id === current);
  return current && !areas.some((a) => a.id === current)
    ? [...list, { id: current, label: defaultAreaLabel(current) }]
    : list;
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

const m = messages(
  {
    noName: 'Cada área necesita un nombre.',
    tooLong: `Los nombres no pueden pasar de ${AREA_LABEL_MAX} caracteres.`,
    duplicate: 'Dos áreas no pueden llamarse igual.',
    tooFew: `Deja al menos ${MIN_VISIBLE_AREAS} áreas a la vista.`,
    tooMany: `Puedes tener hasta ${MAX_VISIBLE_AREAS} áreas a la vista.`
  },
  {
    noName: 'Each area needs a name.',
    tooLong: `Names can’t be longer than ${AREA_LABEL_MAX} characters.`,
    duplicate: 'Two areas can’t have the same name.',
    tooFew: `Keep at least ${MIN_VISIBLE_AREAS} areas in view.`,
    tooMany: `You can have up to ${MAX_VISIBLE_AREAS} areas in view.`
  }
);

// Nombres no vacíos, cortos y distintos, y entre 3 y 12 áreas visibles
export const validateAreas = (areas: WheelArea[]): string | null => {
  if (areas.some((a) => !a.label.trim())) return m.noName;
  if (areas.some((a) => a.label.trim().length > AREA_LABEL_MAX)) return m.tooLong;
  const names = areas.map((a) => a.label.trim().toLocaleLowerCase(LOCALE_TAG));
  if (new Set(names).size !== names.length) return m.duplicate;
  const visible = visibleAreas(areas).length;
  if (visible < MIN_VISIBLE_AREAS) return m.tooFew;
  if (visible > MAX_VISIBLE_AREAS) return m.tooMany;
  return null;
};

// Media de una evaluación: de las áreas que puntuó (una evaluación antigua no tiene las áreas añadidas después)
export const logAverage = (scores: Record<string, number>) => {
  const values = Object.values(scores).filter((v) => typeof v === 'number');
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
};
