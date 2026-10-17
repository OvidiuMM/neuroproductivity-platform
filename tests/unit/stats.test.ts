import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeStats, recommendationsFor } from '../../src/services/stats.ts';
import type { Goal, Project, TaskItem, WheelOfLifeLog } from '../../src/types';

const now = new Date(2026, 9, 14, 12, 0); // miércoles 14 oct 2026, 12:00
const at = (day: number, hour = 10) => new Date(2026, 9, day, hour, 0).toISOString();

const task = (id: string, overrides: Partial<TaskItem> = {}): TaskItem => ({
  id,
  userId: 'uid',
  listContext: 'WORK',
  title: `Tarea ${id}`,
  description: '',
  priority: 'MEDIUM',
  createdAt: at(1),
  updatedAt: at(1),
  observations: [],
  isSomeday: false,
  status: 'PENDING',
  ...overrides
});
const done = (id: string, day: number, overrides: Partial<TaskItem> = {}) =>
  task(id, { status: 'DONE', doneAt: at(day), ...overrides });

describe('computeStats', () => {
  it('counts tasks done today, this week (from Monday) and this month', () => {
    const stats = computeStats(
      [done('a', 14), done('b', 13), done('c', 12), done('d', 11), done('e', 1), task('open')],
      now
    );
    assert.equal(stats.doneToday, 1);
    assert.equal(stats.doneThisWeek, 3); // lunes 12, martes 13 y hoy
    assert.equal(stats.doneThisMonth, 5);
  });

  it('cancelled tasks count neither as done nor as open', () => {
    const stats = computeStats(
      [done('a', 14), task('cancelled', { status: 'CANCELLED', doneAt: at(14), dueDate: '2026-10-10' }), task('open')],
      now
    );
    assert.equal(stats.doneToday, 1);
    assert.equal(stats.open, 1);
    assert.equal(stats.overdue, 0);
  });

  it('lists the last 14 days, today last', () => {
    const stats = computeStats([done('a', 14), done('b', 14), done('c', 1)], now);
    assert.equal(stats.daily.length, 14);
    assert.deepEqual(stats.daily.at(-1), { date: '2026-10-14', count: 2 });
    assert.deepEqual(stats.daily[0], { date: '2026-10-01', count: 1 });
  });

  it('splits dated tasks done in the last 30 days into on time and late', () => {
    const stats = computeStats(
      [
        done('early', 10, { dueDate: '2026-10-12' }),
        done('same-day', 12, { dueDate: '2026-10-12' }), // sin hora vence al final del día
        done('late-hour', 12, { dueDate: '2026-10-12', dueTime: '09:00' }),
        done('late', 13, { dueDate: '2026-10-12' }),
        done('no-date', 13)
      ],
      now
    );
    assert.equal(stats.onTime, 2);
    assert.equal(stats.late, 2);
    assert.equal(stats.onTimeRate, 0.5);
  });

  it('computes velocity, estimated hours and the average cycle time', () => {
    const stats = computeStats(
      [
        done('a', 13, { estimateMinutes: 60, createdAt: at(11) }),
        done('b', 14, { estimateMinutes: 120, createdAt: at(13) })
      ],
      now
    );
    // 2 tareas en 4 semanas completas + la actual (2,5 días de 7)
    assert.ok(Math.abs(stats.weeklyVelocity - 2 / (4 + 2.5 / 7)) < 0.01);
    assert.ok(Math.abs(stats.weeklyEstimatedHours - 3 / (4 + 2.5 / 7)) < 0.01);
    assert.equal(stats.avgCycleDays, 1.5);
  });

  it('ignores tasks marked done after now (a device clock set ahead)', () => {
    const stats = computeStats(
      [done('future', 14, { doneAt: new Date(2026, 9, 14, 18, 0).toISOString() }), done('past', 14)],
      now
    );
    assert.equal(stats.doneToday, 1);
    assert.equal(stats.doneThisWeek, 1);
  });

  it('measures velocity on Monday morning with only the time elapsed this week', () => {
    const monday = new Date(2026, 9, 19, 6, 0); // 6 h de la semana nueva
    const stats = computeStats([done('a', 13), done('b', 14)], monday);
    assert.ok(Math.abs(stats.weeklyVelocity - 2 / (4 + 0.25 / 7)) < 0.001);
  });

  it('counts the streak from today, or from yesterday while today has none yet', () => {
    assert.equal(computeStats([done('a', 14), done('b', 13), done('c', 12), done('d', 10)], now).streak, 3);
    assert.equal(computeStats([done('b', 13), done('c', 12)], now).streak, 2);
    assert.equal(computeStats([done('c', 11)], now).streak, 0);
  });

  it('counts open, overdue and due-this-week tasks, leaving «Algún día» out', () => {
    const stats = computeStats(
      [
        task('overdue', { dueDate: '2026-10-13' }),
        task('soon', { dueDate: '2026-10-16' }),
        task('sunday', { dueDate: '2026-10-18' }),
        task('next-week', { dueDate: '2026-10-19' }),
        task('someday', { isSomeday: true, dueDate: '2026-10-13' })
      ],
      now
    );
    assert.equal(stats.open, 4);
    assert.equal(stats.overdue, 1);
    assert.equal(stats.dueThisWeek, 2);
  });

  it('ends the week at next Monday even when the clocks change on Sunday', () => {
    const previousTz = process.env.TZ;
    process.env.TZ = 'Europe/Madrid'; // el 25 oct 2026 la hora se retrasa: esa semana dura 169 horas
    try {
      const wednesday = new Date(2026, 9, 21, 12, 0);
      const stats = computeStats(
        [
          task('late-sunday', { dueDate: '2026-10-25', dueTime: '23:30' }),
          task('monday', { dueDate: '2026-10-26', dueTime: '00:30' })
        ],
        wednesday
      );
      assert.equal(stats.dueThisWeek, 1);
    } finally {
      // Si no había TZ, se borra (asignar undefined guardaría el texto «undefined»)
      if (previousTz === undefined) delete process.env.TZ;
      else process.env.TZ = previousTz;
    }
  });

  it('ranks areas by tasks done in the last 30 days', () => {
    const stats = computeStats(
      [
        done('a', 14, { wheelCategory: 'Salud' }),
        done('b', 13, { wheelCategory: 'Finanzas' }),
        done('c', 12, { wheelCategory: 'Salud' })
      ],
      now
    );
    assert.deepEqual(stats.byArea, [
      { area: 'Salud', count: 2 },
      { area: 'Finanzas', count: 1 }
    ]);
  });
});

describe('recommendationsFor', () => {
  const wheel = (day: number): WheelOfLifeLog => ({
    id: `w${day}`,
    userId: 'uid',
    timestamp: at(day),
    scores: {}
  });

  it('starts with the oldest overdue task and suggests evaluating the wheel when it is old', () => {
    const tasks = [
      task('old', { title: 'Pagar el seguro', dueDate: '2026-10-05' }),
      task('new', { dueDate: '2026-10-13' })
    ];
    const recs = recommendationsFor(computeStats(tasks, now), tasks, [], now);
    assert.equal(recs[0].id, 'overdue');
    assert.match(recs[0].text, /2 tareas vencidas.*«Pagar el seguro»/);
    assert.ok(recs.some((r) => r.id === 'wheel'));
    assert.ok(recs.length <= 3);
  });

  it('suggests restarting when nothing was done this calendar week, even if last week had completions', () => {
    const monday = new Date(2026, 9, 19, 9, 0); // lunes 19: lo último hecho fue el martes 13
    const tasks = [done('last-week', 13, { dueDate: '2026-10-14' }), task('open', { dueDate: '2026-10-30' })];
    const recs = recommendationsFor(computeStats(tasks, monday), tasks, [wheel(18)], monday);
    assert.ok(recs.some((r) => r.id === 'restart'));
  });

  it('says nothing when everything is on track', () => {
    const tasks = [done('a', 14, { dueDate: '2026-10-15' }), task('b', { dueDate: '2026-10-30' })];
    assert.deepEqual(recommendationsFor(computeStats(tasks, now), tasks, [wheel(10)], now), []);
  });
});

describe('the goal recommendation', () => {
  const now = new Date(2026, 9, 15, 10, 0);
  const log = (scores: Partial<Record<string, number>>) => ({
    id: 'w1',
    userId: 'u',
    timestamp: new Date(2026, 9, 10).toISOString(),
    scores: {
      Salud: 7,
      'Carrera Profesional': 7,
      Finanzas: 7,
      Familia: 7,
      Ocio: 7,
      Relaciones: 7,
      Espiritualidad: 7,
      ...scores
    } as WheelOfLifeLog['scores']
  });
  const goal = (area: Goal['area']): Goal => ({
    id: `g-${area}`,
    userId: 'u',
    title: 'Ahorrar',
    area,
    status: 'ACTIVE',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  });
  const recs = (logs: WheelOfLifeLog[], goals: Goal[]) =>
    recommendationsFor(computeStats([], now), [], logs, now, goals).map((r) => r.id);

  it('points to Metas when the lowest area needs attention and has no goal', () => {
    const [first] = recommendationsFor(computeStats([], now), [], [log({ Finanzas: 3 })], now, []);
    assert.equal(first.id, 'goal');
    assert.equal(
      first.text,
      '«Finanzas» tiene 3/10 en tu última evaluación y aún no tiene metas. Ponle una meta concreta y añádele la primera tarea.'
    );
    assert.deepEqual(first.action, { label: 'Ir a Metas', tab: 'goals' });
  });

  it('is not shown once that area has a goal, when it scores above 5 or without an evaluation', () => {
    assert.ok(!recs([log({ Finanzas: 3 })], [goal('Finanzas')]).includes('goal'));
    assert.ok(!recs([log({ Finanzas: 6 })], []).includes('goal'));
    assert.ok(!recs([], []).includes('goal'));
  });
});

describe('cancelled, blocked and projects', () => {
  it('counts the tasks cancelled this month and the ones that cannot be done yet', () => {
    const tasks = [
      task('cancelled', { status: 'CANCELLED', doneAt: at(10) }),
      task('old-cancel', { status: 'CANCELLED', doneAt: new Date(2026, 8, 20).toISOString() }),
      task('manual', { status: 'BLOCKED' }),
      task('waiting', { dependsOn: 'other-list' }),
      task('free', { dependsOn: 'finished' })
    ];
    // La tarea a la que espera puede estar en la otra lista
    const all = [
      ...tasks,
      task('other-list', { listContext: 'PERSONAL' }),
      task('finished', { status: 'DONE', doneAt: at(9) })
    ];
    const stats = computeStats(tasks, now, all);
    assert.equal(stats.cancelledThisMonth, 1);
    assert.equal(stats.blocked, 2);
    assert.equal(stats.open, 3);
  });

  it('recommends looking at a project that runs late first', () => {
    const project = (id: string, endDate: string): Project => ({
      id,
      userId: 'uid',
      title: id,
      goalId: 'g1',
      endDate,
      status: 'ACTIVE',
      createdAt: at(1),
      updatedAt: at(1)
    });
    const tasks = [task('t1', { projectId: 'cocina' }), task('t2', { projectId: 'cocina' })];
    const [first] = recommendationsFor(computeStats(tasks, now), tasks, [], now, [], undefined, [
      project('cocina', '2026-10-10'),
      project('jardín', '2026-12-01')
    ]);
    assert.equal(first.id, 'project-overdue');
    assert.match(
      first.text,
      /^El proyecto «cocina» va fuera de plazo: terminaba el 10 oct 2026 y le quedan 2 tareas\./
    );
    assert.deepEqual(first.action, { label: 'Ver los proyectos', tab: 'projects' });
  });
});
