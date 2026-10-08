import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

// Se ejecuta contra el emulador de Firestore: npm run test:rules
describe('firestore.rules', () => {
  let env: RulesTestEnvironment;

  before(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-neuroproductivity',
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
    });
  });

  beforeEach(async () => {
    await env.clearFirestore();
  });

  after(async () => {
    await env.cleanup();
  });

  const task = { id: 'task-1', title: 'Llamar al taller', completed: false };
  const wheelLog = { id: 'wheel-1', timestamp: '2026-10-08T10:00:00.000Z', scores: { Salud: 7 } };

  it('lets a signed-in person read and write their own data', async () => {
    const ana = env.authenticatedContext('ana').firestore();

    await assertSucceeds(setDoc(doc(ana, 'users/ana'), { name: 'Ana' }));
    await assertSucceeds(setDoc(doc(ana, 'users/ana/tasks/task-1'), task));
    await assertSucceeds(updateDoc(doc(ana, 'users/ana/tasks/task-1'), { completed: true }));
    await assertSucceeds(getDoc(doc(ana, 'users/ana/tasks/task-1')));
    await assertSucceeds(deleteDoc(doc(ana, 'users/ana/tasks/task-1')));
  });

  it("denies reading or writing another person's data", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/ana/tasks/task-1'), task);
    });
    const bruno = env.authenticatedContext('bruno').firestore();

    await assertFails(getDoc(doc(bruno, 'users/ana')));
    await assertFails(getDoc(doc(bruno, 'users/ana/tasks/task-1')));
    await assertFails(setDoc(doc(bruno, 'users/ana/tasks/task-2'), task));
    await assertFails(deleteDoc(doc(bruno, 'users/ana/tasks/task-1')));
  });

  it('denies everything to signed-out visitors', async () => {
    const anonymous = env.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(anonymous, 'users/ana/tasks/task-1')));
    await assertFails(setDoc(doc(anonymous, 'users/ana/tasks/task-1'), task));
  });

  it('keeps wheel evaluations append-only, allowing identical rewrites and deletion', async () => {
    const ana = env.authenticatedContext('ana').firestore();
    const ref = doc(ana, 'users/ana/wheelLogs/wheel-1');

    await assertSucceeds(setDoc(ref, wheelLog));
    await assertFails(updateDoc(ref, { scores: { Salud: 10 } }));
    await assertSucceeds(setDoc(ref, wheelLog));
    await assertSucceeds(deleteDoc(ref));
  });

  it('rejects collections outside the allowed list', async () => {
    const ana = env.authenticatedContext('ana').firestore();

    await assertFails(setDoc(doc(ana, 'users/ana/secrets/x'), { value: 1 }));
    await assertFails(setDoc(doc(ana, 'other/x'), { value: 1 }));
  });
});
