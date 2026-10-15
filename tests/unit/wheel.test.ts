import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_AREAS,
  areaLabel,
  areasInUse,
  isAreaId,
  logAverage,
  resolveAreas,
  selectableAreas,
  validateAreas,
  visibleAreas
} from '../../src/services/wheel.ts';
import { areasWithGoals } from '../../src/services/goals.ts';
import { inferWheelCategory } from '../../src/services/nlpEngine.ts';
import { DEFAULT_LIST_PREFS, arrangeTasks } from '../../src/services/taskListing.ts';
import type { Goal, TaskItem, WheelArea } from '../../src/types';

const custom: WheelArea[] = [
  { id: 'Salud', label: 'Cuerpo' },
  { id: 'Carrera Profesional', label: 'Trabajo' },
  { id: 'Espiritualidad', label: 'Espiritualidad', hidden: true },
  { id: 'area-abc1', label: 'Aprendizaje' }
];

test('without saved areas there are the seven starting ones; odd entries are dropped', () => {
  assert.deepEqual(resolveAreas(undefined), DEFAULT_AREAS);
  assert.deepEqual(resolveAreas([]), DEFAULT_AREAS);
  assert.deepEqual(
    resolveAreas([
      { id: 'Salud', label: ' Cuerpo ' },
      { id: 'Salud', label: 'Repetida' },
      { id: '', label: 'Sin id' },
      { id: 'area-x', label: '   ' },
      'raro',
      { id: 'Ocio', label: 'Ocio', hidden: true }
    ]),
    [
      { id: 'Salud', label: 'Cuerpo' },
      { id: 'Ocio', label: 'Ocio', hidden: true }
    ]
  );
  // Si todas quedaran ocultas, las de partida
  assert.deepEqual(resolveAreas([{ id: 'Ocio', label: 'Ocio', hidden: true }]), DEFAULT_AREAS);
});

test('names come from the account; hidden ones stay selectable while chosen', () => {
  assert.equal(areaLabel(custom, 'Salud'), 'Cuerpo');
  assert.equal(areaLabel(custom, 'area-desconocida'), 'area-desconocida');
  assert.deepEqual(
    visibleAreas(custom).map((a) => a.id),
    ['Salud', 'Carrera Profesional', 'area-abc1']
  );
  assert.deepEqual(
    selectableAreas(custom, 'Espiritualidad').map((a) => a.id),
    ['Salud', 'Carrera Profesional', 'Espiritualidad', 'area-abc1']
  );
  assert.deepEqual(selectableAreas(custom, 'area-borrada').at(-1), { id: 'area-borrada', label: 'area-borrada' });
  assert.deepEqual(areasInUse(custom, ['area-abc1', 'Salud', 'Ocio']), ['Salud', 'area-abc1', 'Ocio']);
});

test('areas need distinct short names and between 3 and 12 in view', () => {
  assert.equal(validateAreas(custom), null);
  assert.equal(validateAreas([...custom, { id: 'area-y', label: '' }]), 'Cada área necesita un nombre.');
  assert.equal(validateAreas([...custom, { id: 'area-y', label: 'cuerpo' }]), 'Dos áreas no pueden llamarse igual.');
  assert.match(validateAreas([...custom, { id: 'area-y', label: 'x'.repeat(31) }])!, /30 caracteres/);
  assert.equal(
    validateAreas(custom.map((a) => (a.id === 'area-abc1' ? { ...a, hidden: true } : a))),
    'Deja al menos 3 áreas a la vista.'
  );
  const many = Array.from({ length: 13 }, (_, i) => ({ id: `area-${i}`, label: `Área ${i}` }));
  assert.equal(validateAreas(many), 'Puedes tener hasta 12 áreas a la vista.');
});

test('only area ids are accepted as stored filters, and averages count the areas each evaluation had', () => {
  assert.equal(isAreaId('Salud'), true);
  assert.equal(isAreaId('area-k3x9'), true);
  assert.equal(isAreaId('constructor'), false);
  assert.equal(isAreaId('ALL'), false);
  assert.equal(logAverage({ Salud: 4, Ocio: 8 }), 6);
  assert.equal(logAverage({}), 0);
});

test('Metas lists the visible areas, plus hidden ones that still have active goals', () => {
  const goal = (id: string, area: string): Goal => ({
    id,
    userId: 'uid',
    title: id,
    area,
    status: 'ACTIVE',
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z'
  });
  const sections = areasWithGoals([goal('g1', 'Espiritualidad'), goal('g2', 'area-abc1')], null, custom);
  assert.deepEqual(
    sections.map((s) => [s.area, s.goals.length]),
    [
      ['Salud', 0],
      ['Carrera Profesional', 0],
      ['area-abc1', 1],
      ['Espiritualidad', 1]
    ]
  );
});

test('suggestions use the visible areas: an added area by the words of its name, never a hidden one', () => {
  assert.equal(
    inferWheelCategory('Apuntarme a un curso', 'Seguir con el aprendizaje de alemán', custom).category,
    'area-abc1'
  );
  // Una de partida renombrada conserva sus palabras clave y suma las de su nombre
  assert.equal(inferWheelCategory('Llamar al médico', 'Pedir cita para una analítica', custom).category, 'Salud');
  const hidden = inferWheelCategory('Meditar', 'Rezar y leer sobre espiritualidad', custom);
  assert.notEqual(hidden.category, 'Espiritualidad');
  assert.equal('Espiritualidad' in hidden.allScores, false);
});

test('sorting by area follows the names the account gave them', () => {
  const task = (id: string, wheelCategory: string): TaskItem => ({
    id,
    userId: 'uid',
    listContext: 'WORK',
    title: id,
    description: '',
    priority: 'MEDIUM',
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
    observations: [],
    isSomeday: false,
    status: 'PENDING',
    wheelCategory
  });
  const sorted = arrangeTasks(
    [task('t', 'Carrera Profesional'), task('a', 'area-abc1'), task('c', 'Salud')],
    { ...DEFAULT_LIST_PREFS, sortBy: 'category' },
    new Date(2026, 9, 16),
    (id) => areaLabel(custom, id)
  );
  // Aprendizaje, Cuerpo, Trabajo
  assert.deepEqual(
    sorted.map((t) => t.id),
    ['a', 'c', 't']
  );
});
