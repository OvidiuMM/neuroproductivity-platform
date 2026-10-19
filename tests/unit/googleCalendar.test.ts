import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FirebaseError } from 'firebase/app';
import { authorizationUrl, calendarErrorMessage } from '../../src/services/googleCalendar.ts';

test('server messages are shown as they come, and only the SDK generic ones are replaced', () => {
  const server = new FirebaseError(
    'functions/unavailable',
    'Se conectó, pero no se pudieron subir las tareas. Desconecta y vuelve a conectar para subirlas.'
  );
  assert.equal(calendarErrorMessage(server, 'x'), server.message);
  // Sin el código de estado que añade el SDK
  assert.equal(
    calendarErrorMessage(new FirebaseError('functions/failed-precondition', 'Vuelve a conectar. [400]'), 'x'),
    'Vuelve a conectar.'
  );
  assert.match(calendarErrorMessage(new FirebaseError('functions/internal', 'internal'), 'x'), /No se pudo conectar/);
  assert.match(
    calendarErrorMessage(new FirebaseError('functions/deadline-exceeded', 'deadline-exceeded'), 'x'),
    /sigue en marcha/
  );
  assert.equal(calendarErrorMessage(new Error('No se dio permiso en Google.'), 'x'), 'No se dio permiso en Google.');
  assert.equal(calendarErrorMessage('raro', 'Por defecto'), 'Por defecto');
});

test('the authorization asks only for its own calendar, offline, with PKCE and without the email', () => {
  const url = new URL(
    authorizationUrl({
      clientId: 'id',
      redirectUri: 'https://clar.example/oauth/google.html',
      state: 's',
      challenge: 'c'
    })
  );
  assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(url.searchParams.get('scope'), 'https://www.googleapis.com/auth/calendar.app.created');
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.searchParams.get('prompt'), 'consent');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.has('login_hint'), false);
});
