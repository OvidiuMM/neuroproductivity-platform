import { expect, test, type Page } from '@playwright/test';
import { patchDocument, readDocument, signInWithGoogle, uidOf, uniqueEmail, writeTextDocument } from './helpers';

// Conexión con Google Calendar desde «Tu cuenta». Google no tiene emulador: la ventana de autorización se intercepta y
// vuelve a la app con un código de mentira, y el estado de la conexión se prepara a mano. En los emuladores el
// servidor no canjea códigos (lo dice), así que aquí se prueba todo lo que hace la app.
const SERVER_CALL = { timeout: 15_000 };
const CALENDAR = 'Sincronizar con Google Calendar';

const grantCalendar = async (uid: string) =>
  patchDocument(`features/${uid}`, { granted: { arrayValue: { values: [{ stringValue: 'googleCalendar' }] } } });

const openMenu = async (page: Page) => {
  await page.getByRole('button', { name: 'Tu cuenta' }).click();
  return page.getByRole('dialog', { name: 'Tu cuenta' }).getByRole('region', { name: 'Funciones extra' });
};

// Google simulado: responde a la autorización volviendo a la app con lo que se le diga, y apunta lo que se le pidió
const fakeGoogle = async (page: Page, answer: (state: string) => string) => {
  const requested: URL[] = [];
  await page.context().route('https://accounts.google.com/**', async (route) => {
    const url = new URL(route.request().url());
    requested.push(url);
    await route.fulfill({
      status: 302,
      headers: { location: `${url.searchParams.get('redirect_uri')}?${answer(url.searchParams.get('state') ?? '')}` }
    });
  });
  return requested;
};

test('connecting asks Google only for its own calendar, offline and with PKCE, and returns to the app', async ({
  page
}) => {
  const email = uniqueEmail();
  await page.goto('/');
  await signInWithGoogle(page, email);
  await grantCalendar(await uidOf(email));
  const requested = await fakeGoogle(page, (state) => `state=${state}&code=codigo-de-prueba`);

  const features = await openMenu(page);
  await expect(features).toContainText(CALENDAR);
  await expect(features).toContainText('CLAR no ve ni cambia tus otros calendarios');
  const popup = page.waitForEvent('popup');
  await features.getByRole('button', { name: 'Conectar Google Calendar' }).click();
  await (await popup).waitForEvent('close');

  // El código vuelve a la app, que lo envía al servidor: en los emuladores no se puede canjear y se dice
  await expect(features.getByRole('alert')).toHaveText(/no está disponible en esta instalación/, SERVER_CALL);
  const [authorization] = requested;
  const origin = new URL(page.url()).origin;
  expect(Object.fromEntries(authorization.searchParams)).toMatchObject({
    client_id: 'e2e-client-id',
    redirect_uri: `${origin}/oauth/google.html`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.app.created',
    access_type: 'offline',
    prompt: 'consent',
    code_challenge_method: 'S256'
  });
  // Sin el email de la cuenta en la dirección (quedaría en el historial del navegador)
  expect(authorization.searchParams.has('login_hint')).toBe(false);
  expect(authorization.searchParams.get('code_challenge')).toMatch(/^[\w-]{43}$/);
  expect(authorization.searchParams.get('state')).toMatch(/^[\w-]{32}$/);
});

test('saying no in Google, or an answer for another request, connects nothing', async ({ page }) => {
  const email = uniqueEmail();
  await page.goto('/');
  await signInWithGoogle(page, email);
  await grantCalendar(await uidOf(email));
  let answer = (state: string) => `state=${state}&error=access_denied`;
  await fakeGoogle(page, (state) => answer(state));
  const features = await openMenu(page);
  const connect = features.getByRole('button', { name: 'Conectar Google Calendar' });

  await connect.click();
  await expect(features.getByRole('alert')).toHaveText(
    'No se dio permiso en Google: el calendario no se ha conectado.'
  );
  // El foco no se pierde: vuelve al botón
  await expect(connect).toBeFocused();

  // Una respuesta con otro `state` no cuenta: la app sigue esperando y se puede cancelar
  answer = () => 'state=otra-peticion&code=codigo-ajeno';
  await connect.click();
  await expect(features).toContainText('Esperando a Google');
  // Mientras se espera, el foco está en «Cancelar»
  const cancel = features.getByRole('button', { name: 'Cancelar la conexión con Google Calendar' });
  await expect(cancel).toBeFocused();
  await cancel.click();
  await expect(connect).toBeFocused();
  await expect(features.getByRole('alert')).toHaveCount(0);
});

test('a connected account sees it and can disconnect; one whose permission Google withdrew is asked to reconnect', async ({
  page
}) => {
  const email = uniqueEmail();
  await page.goto('/');
  await signInWithGoogle(page, email);
  const uid = await uidOf(email);
  await grantCalendar(uid);
  await writeTextDocument(`calendar_status/${uid}`, { state: 'connected', calendarId: 'calendario-1' });

  const features = await openMenu(page);
  await expect(features).toContainText('Conectado: tus tareas con fecha están en el calendario «CLAR»');
  await features.getByRole('button', { name: 'Desconectar Google Calendar' }).click();
  await expect(features).toContainText('El calendario «CLAR» se queda en tu cuenta de Google', SERVER_CALL);
  await expect(features.getByRole('button', { name: 'Conectar Google Calendar' })).toBeFocused();
  // El servidor guarda el calendario para volver a usarlo al conectar otra vez
  expect(await readDocument(`calendar_status/${uid}`)).toMatchObject({
    state: 'disconnected',
    calendarId: 'calendario-1'
  });

  await writeTextDocument(`calendar_status/${uid}`, { state: 'needsReconnect', reason: 'revoked' });
  await expect(features).toContainText('El permiso de Google ya no vale');
  await expect(features.getByRole('button', { name: 'Volver a conectar' })).toBeVisible();
});
