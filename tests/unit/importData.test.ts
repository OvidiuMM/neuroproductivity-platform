import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeAreas, parseAccountExport, planImport } from '../../src/services/importData.ts';
import { DEFAULT_AREAS } from '../../src/services/wheel.ts';
import type { UserCollection } from '../../src/services/repository.ts';

const createdAt = '2026-10-01T09:00:00.000Z';
const task = { id: 'task-1', userId: 'other', title: 'Llamar al taller', listContext: 'WORK', createdAt };
const goal = { id: 'goal-1', userId: 'other', title: 'Correr una media', area: 'Salud', status: 'ACTIVE', createdAt };
const project = { id: 'project-1', title: 'Plan de 12 semanas', goalId: 'goal-1', endDate: '2026-12-20', createdAt };
const log = { id: 'wheel-1', timestamp: createdAt, scores: { Salud: 7, Ocio: 4 } };

const file = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    app: 'CLAR',
    version: '0.9.5',
    type: 'account',
    exportedAt: '2026-10-16T08:00:00.000Z',
    account: { name: 'Ana', email: 'ana@example.com' },
    tasks: [task],
    goals: [goal],
    projects: [project],
    wheelLogs: [log],
    meetings: [],
    emails: [],
    ...extra
  });

const none = (): Record<UserCollection, Set<string>> => ({
  tasks: new Set(),
  goals: new Set(),
  projects: new Set(),
  wheelLogs: new Set(),
  meetings: new Set(),
  emails: new Set()
});

test('reads a full download and keeps only known fields, without the source account', () => {
  const parsed = parseAccountExport(file({ tasks: [{ ...task, injected: '<script>', priority: 'HIGH' }] }));
  assert.equal(parsed.exportedAt, '2026-10-16T08:00:00.000Z');
  const [read] = parsed.data.tasks;
  assert.equal(read.title, 'Llamar al taller');
  assert.equal(read.priority, 'HIGH');
  assert.equal(read.status, 'PENDING');
  assert.equal(read.description, '');
  assert.deepEqual(read.observations, []);
  assert.equal('injected' in read, false);
  assert.equal('userId' in read, false);
  assert.equal(parsed.data.goals[0].area, 'Salud');
  assert.equal(parsed.data.projects[0].status, 'ACTIVE');
  assert.deepEqual(parsed.data.wheelLogs[0].scores, { Salud: 7, Ocio: 4 });
});

test('accepts downloads from before 0.9.5, which have no type, and old tasks with `completed`', () => {
  const old = JSON.parse(file()) as Record<string, unknown>;
  delete old.app;
  delete old.version;
  delete old.type;
  old.tasks = [{ ...task, completed: true }];
  const parsed = parseAccountExport(JSON.stringify(old));
  assert.equal(parsed.data.tasks[0].status, 'DONE');
});

test('counts invalid records and repeated ids, and drops invalid optional fields', () => {
  const parsed = parseAccountExport(
    file({
      tasks: [
        task,
        { ...task }, // id repetido
        { ...task, id: 'task-2', title: '   ' },
        { ...task, id: 'a/b' },
        { ...task, id: 'task-3', listContext: 'OTHER' },
        { ...task, id: 'task-4', dueDate: '31/12/2026', dueTime: '24:00', estimateMinutes: -5, goalId: '../x' },
        'not a task'
      ],
      goals: [goal, { ...goal, id: 'goal-2', area: 'Inventada' }],
      wheelLogs: [log, { ...log, id: 'wheel-2', scores: { Salud: 11 } }]
    })
  );
  assert.equal(parsed.data.tasks.length, 2);
  assert.equal(parsed.invalid.tasks, 5);
  const loose = parsed.data.tasks[1];
  assert.equal(loose.id, 'task-4');
  assert.equal(loose.dueDate, undefined);
  assert.equal(loose.dueTime, undefined);
  assert.equal(loose.estimateMinutes, undefined);
  assert.equal(loose.goalId, undefined);
  assert.equal(parsed.invalid.goals, 1);
  assert.equal(parsed.invalid.wheelLogs, 1);
});

test('rejects files that are not the account download, with a reason', () => {
  assert.throws(() => parseAccountExport('{nope'), /no es un JSON válido/);
  assert.throws(() => parseAccountExport('[]'), /no es una descarga de CLAR/);
  assert.throws(() => parseAccountExport(JSON.stringify({ app: 'Otra', tasks: [] })), /no es una descarga de CLAR/);
  assert.throws(
    () => parseAccountExport(JSON.stringify({ app: 'CLAR', type: 'task', task })),
    /una sola tarea, meta o proyecto/
  );
  assert.throws(() => parseAccountExport(JSON.stringify({ hello: 'world' })), /Descargar mis datos/);
});

test('plans only what the account does not have yet', () => {
  const existing = none();
  existing.tasks.add('task-1');
  existing.wheelLogs.add('wheel-1');
  const plan = planImport(parseAccountExport(file()), existing, DEFAULT_AREAS);
  assert.deepEqual(plan.counts.tasks, { new: 0, existing: 1, invalid: 0 });
  assert.deepEqual(plan.counts.goals, { new: 1, existing: 0, invalid: 0 });
  assert.deepEqual(plan.counts.wheelLogs, { new: 0, existing: 1, invalid: 0 });
  assert.equal(plan.total, 2);
  assert.deepEqual(
    plan.data.goals.map((g) => g.id),
    ['goal-1']
  );
  assert.equal(plan.areas, null);
});

test('adds the missing areas, renaming a repeated name and hiding those past the visible limit', () => {
  const current = [...DEFAULT_AREAS, { id: 'area-a1', label: 'Aprendizaje' }];
  const incoming = [
    { id: 'Salud', label: 'Cuerpo' }, // ya está: conserva su nombre
    { id: 'area-b2', label: 'aprendizaje' }, // otro id con el mismo nombre
    { id: 'area-c3', label: 'Viajes', hidden: true },
    ...['d', 'e', 'f', 'g', 'h'].map((k) => ({ id: `area-${k}`, label: `Área ${k}` }))
  ];
  const { merged, added } = mergeAreas(current, incoming);
  assert.equal(merged.find((a) => a.id === 'Salud')?.label, 'Salud');
  assert.equal(merged.find((a) => a.id === 'area-b2')?.label, 'aprendizaje (2)');
  assert.equal(merged.find((a) => a.id === 'area-c3')?.hidden, true);
  // 8 a la vista + 4 nuevas = 12; la última nueva entra oculta
  assert.equal(merged.filter((a) => !a.hidden).length, 12);
  assert.equal(added.at(-1)?.hidden, true);
  assert.equal(added.length, 7);
});

test('a plan includes the areas from the file that the account lacks', () => {
  const plan = planImport(
    parseAccountExport(file({ wheelAreas: [...DEFAULT_AREAS, { id: 'area-x1', label: 'Viajes' }] })),
    none(),
    DEFAULT_AREAS
  );
  assert.deepEqual(plan.addedAreas, [{ id: 'area-x1', label: 'Viajes' }]);
  assert.equal(plan.areas?.length, 8);
});
