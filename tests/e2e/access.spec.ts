import { expect, test, type Browser, type Page } from '@playwright/test';
import { ADMIN_EMAIL, expectNoHorizontalOverflow, signInWithGoogle, uniqueEmail } from './helpers';

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
  await page.getByRole('button', { name: /^Accesos, \d+ pendientes$/ }).click();
  await expect(page.getByRole('heading', { name: 'Accesos' })).toBeVisible();
};

const entryIn = (page: Page, group: RegExp, email: string) =>
  page.getByRole('region', { name: group }).getByRole('listitem', { name: new RegExp(email.replace(/[.+]/g, '\\$&')) });

test('a new account asks for access, the admin approves it and later revokes it', async ({ browser }) => {
  const userPage = await openPage(browser);
  const adminPage = await openPage(browser);
  const email = uniqueEmail();

  await requestAccessAs(userPage, email, 'Soy del equipo de pruebas');
  await openAccessTab(adminPage);
  await expectNoHorizontalOverflow(adminPage, 'cabecera con la pestaña Accesos');

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
  expect((await download).suggestedFilename()).toMatch(/^neuroproductividad-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(entryIn(adminPage, /^Rechazadas o retiradas/, email)).toContainText('Retirada');
});

test('a rejected account sees it and cannot ask again right away', async ({ browser }) => {
  const userPage = await openPage(browser);
  const adminPage = await openPage(browser);
  const email = uniqueEmail();

  await requestAccessAs(userPage, email, 'Quiero probar la app');
  await openAccessTab(adminPage);
  await entryIn(adminPage, /^Pendientes/, email).getByRole('button', { name: /^Rechazar/ }).click();

  await expect(userPage.getByRole('heading', { name: 'Solicitud no aprobada' })).toBeVisible();
  await userPage.getByRole('button', { name: 'Volver a solicitar acceso' }).click();
  await expect(userPage.getByRole('alert')).toHaveText('Podrás volver a pedir acceso más adelante.');
  await expect(entryIn(adminPage, /^Rechazadas o retiradas/, email)).toContainText('Rechazada');
});
