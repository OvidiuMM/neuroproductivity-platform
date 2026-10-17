import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  ADMIN_EMAIL,
  callFunction,
  createVerifiedAccount,
  expectNoHorizontalOverflow,
  readDocument,
  signInWithGoogle,
  uniqueEmail
} from './helpers';

// Esperas que pasan por una Cloud Function del emulador: con la suite en paralelo su arranque puede tardar
const SERVER_CALL = { timeout: 15_000 };

const openPage = async (browser: Browser) => (await browser.newContext()).newPage();

// Cuenta nueva que pide acceso con un mensaje
const requestAccessAs = async (page: Page, email: string, message: string) => {
  await page.goto('/');
  await signInWithGoogle(page, email, 'Persona de Prueba', { approve: false });
  await expect(page.getByRole('heading', { name: 'Solicita acceso' })).toBeVisible(SERVER_CALL);
  await expect(page.getByRole('button', { name: 'Tu cuenta' })).toHaveCount(0);
  await page.getByLabel('Mensaje para la administración (opcional)').fill(message);
  await page.getByRole('button', { name: 'Solicitar acceso' }).click();
  await expect(page.getByRole('heading', { name: 'Solicitud enviada' })).toBeVisible(SERVER_CALL);
};

const openAccessTab = async (page: Page) => {
  await page.goto('/');
  await signInWithGoogle(page, ADMIN_EMAIL, 'Administración', { approve: false });
  // La cuenta de administración se aprueba sola y ve la pestaña con el número de pendientes
  await expect(page.getByRole('button', { name: 'Tu cuenta' })).toBeVisible(SERVER_CALL);
  await page.getByRole('button', { name: /^Administración, \d+ pendientes?$/ }).click();
  await expect(page.getByRole('heading', { name: 'Administración' })).toBeVisible();
};

const entryIn = (page: Page, group: RegExp, email: string) =>
  page.getByRole('region', { name: group }).getByRole('listitem', { name: new RegExp(email.replace(/[.+]/g, '\\$&')) });

test('a new account asks for access, the admin approves it and later revokes it', async ({ browser }) => {
  const userPage = await openPage(browser);
  const adminPage = await openPage(browser);
  const email = uniqueEmail();

  await requestAccessAs(userPage, email, 'Soy del equipo de pruebas');
  await openAccessTab(adminPage);
  await expectNoHorizontalOverflow(adminPage, 'cabecera con la pestaña Administración');

  const pending = entryIn(adminPage, /^Pendientes/, email);
  await expect(pending).toContainText('Soy del equipo de pruebas');
  await pending.getByRole('button', { name: /^Aprobar/ }).click();

  // La persona entra en la app sin recargar
  await expect(userPage.getByRole('button', { name: 'Tu cuenta' })).toBeVisible();
  const approved = entryIn(adminPage, /^Con acceso/, email);
  await expect(approved).toBeVisible();

  // Al retirar el acceso la app se cierra y queda el aviso
  await approved.getByRole('button', { name: /^Retirar acceso/ }).click();
  await expect(userPage.getByRole('heading', { name: 'Acceso retirado' })).toBeVisible();
  await expect(userPage.getByRole('button', { name: 'Tu cuenta' })).toHaveCount(0);

  // Sin acceso puede seguir llevándose sus datos
  const download = userPage.waitForEvent('download');
  await userPage.getByRole('button', { name: 'Descargar mis datos' }).click();
  expect((await download).suggestedFilename()).toMatch(/^clar-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(entryIn(adminPage, /^Rechazadas o retiradas/, email)).toContainText('Retirada');
});

test('a rejected account sees it and cannot ask again right away', async ({ browser }) => {
  const userPage = await openPage(browser);
  const adminPage = await openPage(browser);
  const email = uniqueEmail();

  await requestAccessAs(userPage, email, 'Quiero probar la app');
  await openAccessTab(adminPage);
  await entryIn(adminPage, /^Pendientes/, email)
    .getByRole('button', { name: /^Rechazar/ })
    .click();

  await expect(userPage.getByRole('heading', { name: 'Solicitud no aprobada' })).toBeVisible();
  await userPage.getByRole('button', { name: 'Volver a solicitar acceso' }).click();
  await expect(userPage.getByRole('alert')).toHaveText('Podrás volver a pedir acceso más adelante.');
  await expect(entryIn(adminPage, /^Rechazadas o retiradas/, email)).toContainText('Rechazada');
});

test('forgetting the access deletes the account, so a rejected account cannot clear its decision and stay', async ({
  browser
}) => {
  const adminPage = await openPage(browser);
  const password = 'clave-segura-1';
  const { email, uid, idToken } = await createVerifiedAccount(password);
  expect((await callFunction('requestAccess', idToken, { message: '' })).status).toBe(200);
  await openAccessTab(adminPage);
  await entryIn(adminPage, /^Pendientes/, email)
    .getByRole('button', { name: /^Rechazar/ })
    .click();
  await expect(entryIn(adminPage, /^Rechazadas o retiradas/, email)).toContainText('Rechazada');

  // Sin la cuenta no queda nada que vuelva a entrar o a pedir acceso: la contraseña ya no sirve
  expect((await callFunction('forgetAccess', idToken, {})).status).toBe(200);
  expect(await readDocument(`access/${uid}`)).toBeNull();
  const signIn = await fetch(
    'http://127.0.0.1:9399/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    }
  );
  expect(signIn.ok).toBe(false);
});

test('a blocked account sees it, and its email stays blocked even with a new account', async ({ browser }) => {
  test.slow();
  const SERVER_CALL = { timeout: 15_000 };
  // Una cuenta con contraseña, con el email confirmado, que pide acceso
  const { email, idToken } = await createVerifiedAccount();
  expect((await callFunction('requestAccess', idToken, { message: '' })).status).toBe(200);

  const adminPage = await openPage(browser);
  await openAccessTab(adminPage);
  const pendingEntry = entryIn(adminPage, /^Pendientes/, email);
  await pendingEntry.getByRole('button', { name: /^Bloquear/ }).click();
  const blocked = entryIn(adminPage, /^Bloqueadas/, email);
  await expect(blocked).toContainText('Bloqueada');

  // Al entrar, la cuenta está bloqueada y no puede pedir acceso
  const sync = async (token: string) =>
    ((await (await callFunction('syncAccess', token, {})).json()) as { result: { status: string } }).result.status;
  expect(await sync(idToken)).toBe('blocked');
  const again = await callFunction('requestAccess', idToken, { message: 'Otra vez' });
  expect(((await again.json()) as { result: { status: string } }).result.status).toBe('blocked');

  // Elimina la cuenta y crea otra con el mismo email: sigue bloqueada
  expect((await callFunction('forgetAccess', idToken, {})).status).toBe(200);
  await fetch('http://127.0.0.1:9399/identitytoolkit.googleapis.com/v1/accounts:delete?key=demo-api-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });
  // La administración deja de verla antes de que llegue la nueva: con el mismo email no se distinguirían
  await expect(blocked).toHaveCount(0, SERVER_CALL);
  const second = await createVerifiedAccount(undefined, email);
  await expect.poll(() => sync(second.idToken), SERVER_CALL).toBe('blocked');

  // Desbloquear quita el bloqueo del email: la cuenta pasa a «retirada» y podrá volver a pedir acceso
  const reblocked = entryIn(adminPage, /^Bloqueadas/, email);
  await expect(reblocked).toHaveCount(1);
  await reblocked.getByRole('button', { name: /^Desbloquear/ }).click();
  await expect(reblocked).toHaveCount(0);
  await expect(entryIn(adminPage, /^Rechazadas o retiradas/, email)).toContainText('Retirada');
  expect(await sync(second.idToken)).toBe('revoked');
});

test('the person sees «Cuenta bloqueada» right away and cannot ask again', async ({ browser }) => {
  // Dos inicios de sesión (persona y administración): con la suite en paralelo puede pasar de 30 s
  test.slow();
  const userPage = await openPage(browser);
  const adminPage = await openPage(browser);
  const email = uniqueEmail();
  await requestAccessAs(userPage, email, 'Hola');
  await openAccessTab(adminPage);
  await entryIn(adminPage, /^Pendientes/, email)
    .getByRole('button', { name: /^Bloquear/ })
    .click();

  await expect(userPage.getByRole('heading', { name: 'Cuenta bloqueada' })).toBeVisible();
  await expect(userPage.getByRole('button', { name: 'Solicitar acceso' })).toHaveCount(0);
  await expect(userPage.getByRole('button', { name: '¿Alguna duda o problema? Escríbenos' })).toBeVisible();
});
