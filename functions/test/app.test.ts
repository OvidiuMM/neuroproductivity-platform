import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { app } from '../src/app';

describe('API de Cloud Functions', () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    process.env.ANDROID_PACKAGE_NAME = 'org.example.test';
    process.env.ANDROID_SHA256_FINGERPRINT = 'AA:BB:CC';
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => {
    server.close();
  });

  it('GET /api/health responde ok', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'NeuroProductividad Dr. Benito Sipos API');
    assert.equal(typeof body.uptime, 'number');
  });

  it('POST /api/nlp/infer devuelve el título y la descripción recibidos', async () => {
    const res = await fetch(`${baseUrl}/api/nlp/infer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Llamar al dentista', description: 'Pedir cita' }),
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.deepEqual(body.input, { title: 'Llamar al dentista', description: 'Pedir cita' });
  });

  it('POST /api/nlp/infer sin cuerpo no falla', async () => {
    const res = await fetch(`${baseUrl}/api/nlp/infer`, { method: 'POST' });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.deepEqual(body.input, {});
  });

  it('GET /.well-known/assetlinks.json usa los parámetros configurados', async () => {
    const res = await fetch(`${baseUrl}/.well-known/assetlinks.json`);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /application\/json/);
    assert.equal(body[0].target.package_name, 'org.example.test');
    assert.deepEqual(body[0].target.sha256_cert_fingerprints, ['AA:BB:CC']);
  });
});
