import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';

// Se ejecuta contra el emulador de Firestore: npm run test:rules
describe('firestore.rules', () => {
  let env: RulesTestEnvironment;

  before(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-neuroproductivity',
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8281 }
    });
  });

  // Ana y Bruno tienen el acceso aprobado; las solicitudes solo las escriben las Cloud Functions
  const grantAccess = (uid: string, status = 'approved') =>
    env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `access/${uid}`), { status, email: `${uid}@example.com` });
    });

  beforeEach(async () => {
    await env.clearFirestore();
    await grantAccess('ana');
    await grantAccess('bruno');
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

  it('lets the profile hold only the account data and whether the welcome was seen', async () => {
    const ana = env.authenticatedContext('ana').firestore();
    const profile = { name: 'Ana', email: 'ana@example.com', photoUrl: '', createdAt: '', lastLoginAt: '' };

    await assertSucceeds(setDoc(doc(ana, 'users/ana'), profile));
    await assertSucceeds(
      setDoc(
        doc(ana, 'users/ana'),
        {
          hasSeenOnboarding: true,
          onboardingVersion: 1,
          onboardingSeenAt: '2026-10-14T09:30:00.000Z',
          onboardingOutcome: 'completed'
        },
        { merge: true }
      )
    );
    await assertFails(updateDoc(doc(ana, 'users/ana'), { isAdmin: true }));
    await assertFails(setDoc(doc(env.authenticatedContext('bruno').firestore(), 'users/bruno'), { role: 'admin' }));
  });

  it('keeps goals private to their owner, who can create, change and delete them', async () => {
    const goal = { id: 'goal-1', title: 'Correr una media maratón', area: 'Salud', status: 'ACTIVE' };
    const ana = env.authenticatedContext('ana').firestore();
    const bruno = env.authenticatedContext('bruno').firestore();

    await assertSucceeds(setDoc(doc(ana, 'users/ana/goals/goal-1'), goal));
    await assertSucceeds(updateDoc(doc(ana, 'users/ana/goals/goal-1'), { status: 'ACHIEVED' }));
    await assertFails(getDoc(doc(bruno, 'users/ana/goals/goal-1')));
    await assertFails(setDoc(doc(bruno, 'users/ana/goals/goal-2'), goal));
    await assertFails(deleteDoc(doc(bruno, 'users/ana/goals/goal-1')));
    await assertSucceeds(deleteDoc(doc(ana, 'users/ana/goals/goal-1')));
  });

  it('rejects collections outside the allowed list', async () => {
    const ana = env.authenticatedContext('ana').firestore();

    await assertFails(setDoc(doc(ana, 'users/ana/secrets/x'), { value: 1 }));
    await assertFails(setDoc(doc(ana, 'other/x'), { value: 1 }));
  });

  it('does not let a person create or change their data until their access is approved', async () => {
    for (const [uid, status] of [
      ['carla', 'pending'],
      ['dani', 'rejected'],
      ['eva', 'revoked']
    ]) {
      await grantAccess(uid, status);
    }
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/eva/tasks/task-1'), task);
    });
    for (const uid of ['carla', 'dani', 'eva', 'fran']) {
      const person = env.authenticatedContext(uid).firestore();
      await assertFails(setDoc(doc(person, `users/${uid}`), { name: uid }));
      await assertFails(setDoc(doc(person, `users/${uid}/tasks/task-2`), task));
    }
    await assertFails(
      updateDoc(doc(env.authenticatedContext('eva').firestore(), 'users/eva/tasks/task-1'), { completed: true })
    );
  });

  it('still lets a person without approved access download and delete their own data', async () => {
    await grantAccess('eva', 'revoked');
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/eva'), { name: 'Eva' });
      await setDoc(doc(ctx.firestore(), 'users/eva/tasks/task-1'), task);
    });
    const eva = env.authenticatedContext('eva').firestore();
    await assertSucceeds(getDoc(doc(eva, 'users/eva')));
    await assertSucceeds(getDocs(collection(eva, 'users/eva/tasks')));
    await assertSucceeds(deleteDoc(doc(eva, 'users/eva/tasks/task-1')));
    await assertSucceeds(deleteDoc(doc(eva, 'users/eva')));
    // Pero nunca los de otra persona
    const fran = env.authenticatedContext('fran').firestore();
    await assertFails(getDocs(collection(fran, 'users/ana/tasks')));
  });

  it('lets each person read only their own access request, and the admin read all of them', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'admins/admin'), {
        email: 'admin@example.com',
        since: '2026-10-11T10:00:00.000Z'
      });
    });
    const ana = env.authenticatedContext('ana').firestore();
    const admin = env.authenticatedContext('admin', { email: 'admin@example.com' }).firestore();

    await assertSucceeds(getDoc(doc(ana, 'access/ana')));
    await assertFails(getDoc(doc(ana, 'access/bruno')));
    await assertSucceeds(getDocs(collection(admin, 'access')));
    await assertFails(getDocs(collection(ana, 'access')));
    await assertSucceeds(getDoc(doc(admin, 'admins/admin')));
    await assertFails(getDoc(doc(ana, 'admins/admin')));
  });

  it('ignores an admin marker whose email is not the reader’s (e.g. after changing the admin account)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'admins/former'), {
        email: 'antes@example.com',
        since: '2026-10-01T10:00:00.000Z'
      });
    });
    const former = env.authenticatedContext('former', { email: 'otra@example.com' }).firestore();
    await assertFails(getDocs(collection(former, 'access')));
    const noEmail = env.authenticatedContext('former').firestore();
    await assertFails(getDocs(collection(noEmail, 'access')));
  });

  it('never lets a client write access requests or the admin list, not even the admin', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'admins/admin'), {
        email: 'admin@example.com',
        since: '2026-10-11T10:00:00.000Z'
      });
    });
    const carla = env.authenticatedContext('carla').firestore();
    const admin = env.authenticatedContext('admin', { email: 'admin@example.com' }).firestore();

    await assertFails(setDoc(doc(carla, 'access/carla'), { status: 'approved' }));
    await assertFails(updateDoc(doc(admin, 'access/ana'), { status: 'revoked' }));
    await assertFails(deleteDoc(doc(admin, 'access/ana')));
    await assertFails(setDoc(doc(carla, 'admins/carla'), { since: 'now' }));
  });
});
