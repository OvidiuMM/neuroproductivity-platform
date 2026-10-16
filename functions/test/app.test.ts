import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { app } from '../src/app';

describe('Función HTTP api', () => {
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

  it('ya no expone las rutas /api de antes', async () => {
    assert.equal((await fetch(`${baseUrl}/api/health`)).status, 404);
    assert.equal((await fetch(`${baseUrl}/api/nlp/infer`, { method: 'POST' })).status, 404);
  });

  it('GET /.well-known/assetlinks.json usa los parámetros configurados', async () => {
    const res = await fetch(`${baseUrl}/.well-known/assetlinks.json`);
    const body = (await res.json()) as { target: { package_name: string; sha256_cert_fingerprints: string[] } }[];

    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /application\/json/);
    assert.equal(body[0].target.package_name, 'org.example.test');
    assert.deepEqual(body[0].target.sha256_cert_fingerprints, ['AA:BB:CC']);
  });
});
