import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exportFilename, goalExport, projectExport, taskExport } from '../../src/services/exports.ts';
import { fileSlug } from '../../src/services/download.ts';
import type { Goal, Project, TaskItem } from '../../src/types';

const now = new Date(2026, 9, 15, 12, 0);

const goal: Goal = {
  id: 'g1',
  userId: 'uid',
  title: 'Tener la casa a punto',
  area: 'Familia',
  status: 'ACTIVE',
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z'
};

const project: Project = {
  id: 'p1',
  userId: 'uid',
  title: 'Reformar la cocina',
  goalId: 'g1',
  endDate: '2026-10-20',
  status: 'ACTIVE',
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z'
};

const task = (id: string, overrides: Partial<TaskItem> = {}): TaskItem => ({
  id,
  userId: 'uid',
  listContext: 'PERSONAL',
  title: id,
  description: '',
  priority: 'MEDIUM',
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
  observations: [],
  isSomeday: false,
  status: 'PENDING',
  ...overrides
});

const tasks = [
  task('presupuesto', { projectId: 'p1', goalId: 'g1', status: 'DONE' }),
  task('azulejos', { projectId: 'p1', goalId: 'g1', dependsOn: 'presupuesto', dueDate: '2026-10-25' }),
  task('montar', { projectId: 'p1', goalId: 'g1', dependsOn: 'azulejos' }),
  task('pintar', { goalId: 'g1' }),
  task('otra')
];
const context = { tasks, goals: [goal], projects: [project], version: '0.9.3', now };

test('a task is exported with all its fields and the names of what it relates to', () => {
  const data = taskExport(tasks[1], context);
  assert.deepEqual(
    { app: data.app, version: data.version, type: data.type, exportedAt: data.exportedAt },
    { app: 'CLAR', version: '0.9.3', type: 'task', exportedAt: now.toISOString() }
  );
  assert.equal(data.task, tasks[1]);
  assert.deepEqual(data.related, {
    area: null,
    goal: { id: 'g1', title: 'Tener la casa a punto', area: 'Familia', areaLabel: 'Familia', status: 'ACTIVE' },
    project: { id: 'p1', title: 'Reformar la cocina', endDate: '2026-10-20', status: 'ACTIVE' },
    waitsFor: { id: 'presupuesto', title: 'presupuesto', status: 'DONE' },
    waitedBy: [{ id: 'montar', title: 'montar', status: 'PENDING' }]
  });
  assert.deepEqual(taskExport(tasks[4], context).related, {
    area: null,
    goal: null,
    project: null,
    waitsFor: null,
    waitedBy: []
  });
  // Con el área renombrada, su nombre de ahora
  const renamed = { ...context, areas: [{ id: 'Familia', label: 'Casa' }] };
  assert.equal(taskExport({ ...tasks[3], wheelCategory: 'Familia' }, renamed).related.area?.label, 'Casa');
  assert.equal(goalExport(goal, renamed).areaLabel, 'Casa');
});

test('a goal is exported with its progress, its projects and all its tasks, those of its projects too', () => {
  const data = goalExport(goal, context);
  assert.equal(data.type, 'goal');
  assert.deepEqual(data.progress, { done: 1, total: 4 });
  assert.deepEqual(
    data.projects.map((p) => [p.id, p.progress.percent]),
    [['p1', 33]]
  );
  assert.deepEqual(
    data.tasks.map((t) => t.id),
    ['presupuesto', 'azulejos', 'montar', 'pintar']
  );
});

test('a project is exported with its goal, progress, deadline and tasks', () => {
  const data = projectExport(project, context);
  assert.equal(data.type, 'project');
  assert.equal(data.goal?.title, 'Tener la casa a punto');
  assert.deepEqual(data.progress, { done: 1, total: 3, percent: 33 });
  assert.deepEqual(data.deadline, {
    state: 'soon',
    openTasks: 2,
    tasksDueAfterEnd: [{ id: 'azulejos', title: 'azulejos', status: 'PENDING' }]
  });
  assert.deepEqual(
    data.tasks.map((t) => t.id),
    ['presupuesto', 'azulejos', 'montar']
  );
});

test('file names carry the kind, the title and the day', () => {
  assert.equal(
    exportFilename('tarea', 'Llamar al proveedor: ¡ya!', now),
    'clar-tarea-llamar-al-proveedor-ya-2026-10-15.json'
  );
  assert.equal(exportFilename('meta', '***', now), 'clar-meta-meta-2026-10-15.json');
  assert.equal(fileSlug('Reformar la cocina', 'proyecto'), 'Reformar-la-cocina');
});
