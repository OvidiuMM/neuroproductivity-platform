import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HttpsError, type CallableRequest } from 'firebase-functions/https';
import { callerLanguage, onUserCall, requireAuth, UserError, userErrors } from '../src/callable';
import { messages } from '../src/i18n';
import { registerPushDevice } from '../src/push';

// Los errores de las funciones invocables, en el idioma de quien llama. Sin sesión, o con el idioma en la petición, no
// hace falta leer su perfil (eso lo prueba test/emulator/push.test.ts)
const request = (data: unknown, auth?: { uid: string }) => ({ data, auth }) as unknown as CallableRequest;

const fail = userErrors(
  messages(
    { busy: 'Inténtalo de nuevo en un rato.', retry: (n: number) => `Quedan ${n} intentos.` },
    { busy: 'Try again in a while.', retry: (n) => `${n} attempts left.` }
  )
);

const rejection = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error as HttpsError;
  }
  assert.fail('expected an error');
};

describe('callable errors in the language of the caller', () => {
  it('are Spanish unless a callable sends them in the language of the caller', () => {
    const error = fail('resource-exhausted', (t) => t.retry(2), { retryAt: 'later' });
    assert.ok(error instanceof HttpsError);
    assert.equal(error.code, 'resource-exhausted');
    assert.equal(error.message, 'Quedan 2 intentos.');
    assert.equal(error.in('en').message, '2 attempts left.');
    assert.deepEqual(error.in('en').details, { retryAt: 'later' });
  });

  it('use the language the app sends with the request, also without a session', async () => {
    assert.equal(await callerLanguage(request({ language: 'en' })), 'en');
    assert.equal(await callerLanguage(request({ language: 'fr' })), 'es');
    assert.equal(await callerLanguage(request(null)), 'es');

    const call = onUserCall({}, (req) => {
      requireAuth(req);
      return Promise.resolve('ok');
    });
    const english = await rejection(call.run(request({ language: 'en' })));
    assert.equal(english.code, 'unauthenticated');
    assert.equal(english.message, 'Sign in to continue.');
    assert.equal(english instanceof UserError, false);
    assert.equal((await rejection(call.run(request({})))).message, 'Inicia sesión para continuar.');
  });

  it('leave any other error as it is', async () => {
    const boom = new Error('boom');
    const call = onUserCall({}, () => Promise.reject(boom));
    assert.equal(await rejection(call.run(request({ language: 'en' }))), boom);
    const busy = onUserCall({}, () => Promise.reject(fail('unavailable', (t) => t.busy)));
    assert.equal((await rejection(busy.run(request({ language: 'en' })))).message, 'Try again in a while.');
  });

  it('apply to the real callables, e.g. registering a device', async () => {
    assert.equal(
      (await rejection(Promise.resolve(registerPushDevice.run(request({ language: 'en' }))))).message,
      'Sign in to continue.'
    );
  });
});
