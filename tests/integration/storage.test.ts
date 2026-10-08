import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { DEFAULT_PROFILE_NAME, StorageService } from '../../src/services/storage.ts';
import type { TaskItem, UserProfile, WheelCategory } from '../../src/types';

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

const makeTask = (id: string, userId: string): TaskItem => ({
  id,
  userId,
  listContext: 'WORK',
  title: `Llamar al proveedor ${id}`,
  description: 'Confirmar la fecha de entrega acordada.',
  priority: 'MEDIUM',
  createdAt: '2026-01-01T09:00:00.000Z',
  updatedAt: '2026-01-01T09:00:00.000Z',
  observations: [],
  isSomeday: false,
  completed: false
});

const scores: Record<WheelCategory, number> = {
  Salud: 7,
  'Carrera Profesional': 8,
  Finanzas: 6,
  Familia: 7,
  Ocio: 6,
  Relaciones: 7,
  Espiritualidad: 6
};

describe('StorageService', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  });

  it('persists tasks separately for each user', () => {
    StorageService.saveTasks([makeTask('task-a', 'user-a')], 'user-a');
    StorageService.saveTasks([makeTask('task-b', 'user-b')], 'user-b');

    assert.deepEqual(StorageService.getTasks('user-a').map((task) => task.id), ['task-a']);
    assert.deepEqual(StorageService.getTasks('user-b').map((task) => task.id), ['task-b']);
  });

  it('appends wheel snapshots without replacing previous users’ history', () => {
    const first = StorageService.appendWheelSnapshot(scores, 'Primera evaluación', 'user-a');
    const second = StorageService.appendWheelSnapshot(scores, 'Segunda evaluación', 'user-b');

    assert.deepEqual(StorageService.getAllRawWheelLogs().map((log) => log.id), [first.id, second.id]);
    assert.equal(StorageService.getWheelLogs('user-a')[0].label, 'Primera evaluación');
    assert.equal(StorageService.getWheelLogs('user-b')[0].label, 'Segunda evaluación');
  });

  it('starts a fresh browser with one empty local profile and no demo data', () => {
    const profile = StorageService.initialize();

    assert.equal(profile.name, DEFAULT_PROFILE_NAME);
    assert.equal(profile.authProvider, 'local');
    assert.deepEqual(StorageService.getUsers().map((u) => u.id), [profile.id]);
    assert.equal(StorageService.getActiveUserId(), profile.id);
    assert.deepEqual(StorageService.getTasks(profile.id), []);
    assert.deepEqual(StorageService.getWheelLogs(profile.id), []);

    StorageService.initialize();
    assert.equal(StorageService.getUsers().length, 1, 'initialize must not create a second profile');
  });

  it('removes legacy demo profiles and keeps what the person created', () => {
    const ownProfile: UserProfile = { id: 'user-g-1', name: 'Ana', role: '', color: 'indigo', initials: 'A', authProvider: 'google', createdAt: '2026-10-01T00:00:00.000Z' };
    const demoProfile = { ...ownProfile, id: 'user-1', name: 'Demo' };
    storage.setItem('neuro_users_v1', JSON.stringify([demoProfile, ownProfile]));
    storage.setItem('neuro_active_user_id_v1', 'user-g-1');
    storage.setItem(
      'neuro_tasks_v1',
      JSON.stringify([makeTask('task-w-1', 'user-1'), makeTask('task-own', 'user-g-1'), makeTask('task-in-demo', 'user-1')])
    );

    StorageService.initialize();

    const users = StorageService.getUsers();
    assert.ok(!users.some((u) => u.id === 'user-1'), 'demo profile removed');
    assert.ok(users.some((u) => u.id === 'user-g-1'), 'own profile kept');
    assert.equal(StorageService.getActiveUserId(), 'user-g-1');
    assert.deepEqual(StorageService.getTasks('user-g-1').map((t) => t.id), ['task-own']);

    // Lo creado dentro del perfil de demostración pasa a un perfil nuevo; el registro de semilla desaparece
    const heir = users.find((u) => u.id !== 'user-g-1');
    assert.ok(heir);
    assert.deepEqual(StorageService.getTasks(heir.id).map((t) => t.id), ['task-in-demo']);
    assert.ok(!StorageService.getAllRawTasks().some((t) => t.id === 'task-w-1'));
  });

  it('deletes a profile together with its data', () => {
    const first = StorageService.createUser({ name: 'Uno', role: '', authProvider: 'local' });
    const second = StorageService.createUser({ name: 'Dos', role: '', authProvider: 'local' });
    StorageService.saveTasks([makeTask('task-1', first.id)], first.id);
    StorageService.saveTasks([makeTask('task-2', second.id)], second.id);
    StorageService.appendWheelSnapshot(scores, 'Inicial', first.id);

    assert.equal(StorageService.deleteUser(first.id), true);

    assert.deepEqual(StorageService.getUsers().map((u) => u.id), [second.id]);
    assert.deepEqual(StorageService.getAllRawTasks().map((t) => t.id), ['task-2']);
    assert.deepEqual(StorageService.getAllRawWheelLogs(), []);
  });
});
