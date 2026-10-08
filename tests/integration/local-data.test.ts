import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { buildImport, clearLocalData, getLocalProfiles, ORPHAN_PROFILE_ID } from '../../src/services/localData.ts';
import type { TaskItem, UserProfile, WheelOfLifeLog } from '../../src/types';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, String(value));
  }
}

const profile = (id: string, name: string): UserProfile => ({
  id,
  name,
  role: '',
  color: 'indigo',
  initials: name[0],
  authProvider: 'local',
  createdAt: '2026-10-01T00:00:00.000Z'
});

const task = (id: string, userId: string): TaskItem => ({
  id,
  userId,
  listContext: 'WORK',
  title: `Llamar al proveedor ${id}`,
  description: '',
  priority: 'MEDIUM',
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
  observations: [],
  isSomeday: false,
  completed: false
});

const wheelLog = (id: string, userId: string): WheelOfLifeLog => ({
  id,
  userId,
  timestamp: '2026-10-01T10:00:00.000Z',
  scores: { Salud: 7, 'Carrera Profesional': 6, Finanzas: 5, Familia: 8, Ocio: 4, Relaciones: 7, Espiritualidad: 6 }
});

describe('local data import (version without accounts)', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    storage.setItem('neuro_users_v1', JSON.stringify([profile('user-1', 'Demo'), profile('user-ana', 'Ana'), profile('user-vacio', 'Vacío')]));
    storage.setItem(
      'neuro_tasks_v1',
      JSON.stringify([task('task-w-1', 'user-1'), task('task-a', 'user-ana'), task('task-in-demo', 'user-1'), task('task-gone', 'user-borrado')])
    );
    storage.setItem('neuro_wheel_logs_v1', JSON.stringify([wheelLog('wheel-snapshot-u1-1', 'user-1'), wheelLog('wheel-a', 'user-ana')]));
  });

  it('lists only profiles with data, never demo profiles or demo records', () => {
    const profiles = getLocalProfiles(storage);

    assert.deepEqual(
      profiles.map((p) => [p.id, p.counts.tasks, p.counts.wheelLogs]),
      [
        ['user-ana', 1, 1],
        [ORPHAN_PROFILE_ID, 1, 0],
        ['user-borrado', 1, 0]
      ]
    );
  });

  it('builds the import only from the selected profiles', () => {
    const data = buildImport(['user-ana', ORPHAN_PROFILE_ID], storage);

    assert.deepEqual(data.tasks.map((t) => t.id), ['task-a', 'task-in-demo']);
    assert.deepEqual(data.wheelLogs.map((l) => l.id), ['wheel-a']);
    assert.deepEqual(data.meetings, []);
    assert.deepEqual(data.emails, []);
  });

  it('clears every local key after importing or discarding', () => {
    storage.setItem('unrelated', 'keep');
    clearLocalData(storage);

    assert.deepEqual(getLocalProfiles(storage), []);
    assert.equal(storage.getItem('neuro_users_v1'), null);
    assert.equal(storage.getItem('unrelated'), 'keep');
  });
});
