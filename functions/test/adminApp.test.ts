import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getApps, initializeApp } from 'firebase-admin/app';
import { adminDb } from '../src/adminApp';

describe('app por defecto de firebase-admin', () => {
  it('se crea aunque ya exista otra app con nombre (como la interna de firebase-functions)', () => {
    process.env.GCLOUD_PROJECT ??= 'demo-neuroproductivity';
    initializeApp({ projectId: 'demo-neuroproductivity' }, '__admin__');
    assert.equal(getApps().length, 1);

    const db = adminDb();
    assert.ok(getApps().some((app) => app.name === '[DEFAULT]'));
    // Las siguientes llamadas reutilizan la misma instancia
    assert.equal(adminDb(), db);
  });
});
