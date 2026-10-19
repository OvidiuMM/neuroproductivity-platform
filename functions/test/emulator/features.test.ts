import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import { adminDb } from '../../src/adminApp';
import { saveGrantedFeatures } from '../../src/features';
import { forgetFeatures } from '../../src/featuresCleanup';

// Se ejecuta contra el emulador de Firestore (npm run test:push): guardar y quitar las funciones extra de una cuenta
// El proyecto del emulador: firebase-admin lo lee al usarse por primera vez (adminDb), no al importarse
process.env.GCLOUD_PROJECT ??= 'demo-neuroproductivity';

const db = adminDb();
const access = (uid: string, status: string) => db.doc(`access/${uid}`).set({ status, email: `${uid}@example.com` });
const granted = async (uid: string) => (await db.doc(`features/${uid}`).get()).data()?.granted as unknown;

// Solo las cuentas de esta prueba: push.test.ts usa el mismo emulador a la vez
const UIDS = ['carla', 'dani', 'elena', 'nadie'];
const clear = async () => {
  await Promise.all(UIDS.flatMap((uid) => [db.doc(`features/${uid}`).delete(), db.doc(`access/${uid}`).delete()]));
};

describe('extra features', () => {
  beforeEach(clear);
  after(clear);

  it('saves the features of an account with access, and an empty list takes them all away', async () => {
    await access('carla', 'approved');
    await saveGrantedFeatures('carla', ['googleCalendar']);
    assert.deepEqual(await granted('carla'), ['googleCalendar']);
    // Sin funciones no queda documento
    await saveGrantedFeatures('carla', []);
    assert.equal((await db.doc('features/carla').get()).exists, false);
  });

  it('does not save features for an account without access', async () => {
    await access('dani', 'revoked');
    await assert.rejects(saveGrantedFeatures('dani', ['googleCalendar']), /Solo las cuentas con acceso/);
    await assert.rejects(saveGrantedFeatures('nadie', ['googleCalendar']), /Solo las cuentas con acceso/);
    assert.equal((await db.doc('features/dani').get()).exists, false);
    assert.equal((await db.doc('features/nadie').get()).exists, false);
  });

  it('forgets the features of an account', async () => {
    await access('elena', 'approved');
    await saveGrantedFeatures('elena', ['googleCalendar']);
    await forgetFeatures('elena');
    assert.equal((await db.doc('features/elena').get()).exists, false);
    // Sin nada que borrar, tampoco falla
    await forgetFeatures('elena');
  });
});
