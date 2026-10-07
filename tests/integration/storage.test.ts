import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { StorageService } from '../../src/services/storage.ts';
import type { TaskItem, WheelCategory } from '../../src/types';

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
  beforeEach(() => {
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    storage.setItem('neuro_tasks_v1', '[]');
    storage.setItem('neuro_wheel_logs_v1', '[]');
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
});
