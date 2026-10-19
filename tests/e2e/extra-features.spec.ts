import { expect, test, type Browser, type Page } from '@playwright/test';
import { ADMIN_EMAIL, readDocument, signInWithGoogle, uidOf, uniqueEmail } from './helpers';

// Esperas que pasan por una Cloud Function del emulador: con la suite en paralelo su arranque puede tardar
const SERVER_CALL = { timeout: 15_000 };
const CALENDAR = 'Sincronizar con Google Calendar';

const openPage = async (browser: Browser) => (await browser.newContext()).newPage();

const openAdmin = async (page: Page) => {
  await page.goto('/');
  await signInWithGoogle(page, ADMIN_EMAIL, 'Administración', { approve: false });
  await expect(page.getByRole('button', { name: 'Tu cuenta' })).toBeVisible(SERVER_CALL);
};

const openAccountMenu = async (page: Page) => {
  await page.getByRole('button', { name: 'Tu cuenta' }).click();
  return page.getByRole('dialog', { name: 'Tu cuenta' });
};

const entryIn = (page: Page, group: RegExp, email: string) =>
  page.getByRole('region', { name: group }).getByRole('listitem', { name: new RegExp(email.replace(/[.+]/g, '\\$&')) });

test('the admin turns on extra features for an account, which sees them at once, and loses them without access', async ({
  browser
}) => {
  const userPage = await openPage(browser);
  const adminPage = await openPage(browser);
  const email = uniqueEmail();
  await userPage.goto('/');
  await signInWithGoogle(userPage, email);
  const uid = await uidOf(email);

  // Sin funciones extra, el apartado no aparece en su cuenta
  let menu = await openAccountMenu(userPage);
  await expect(menu.getByRole('heading', { name: 'Tu cuenta' })).toBeVisible();
  await expect(menu.getByRole('heading', { name: 'Funciones extra' })).toHaveCount(0);
  await menu.getByRole('button', { name: 'Cerrar', exact: true }).click();

  await openAdmin(adminPage);
  await adminPage.getByRole('button', { name: /^Administración/ }).click();
  const entry = entryIn(adminPage, /^Con acceso/, email);
  await entry.getByRole('button', { name: /^Funciones extra/ }).click();
  await expect(entry.getByRole('button', { name: /^Funciones extra/ })).toHaveAttribute('aria-expanded', 'true');
  await entry.getByRole('checkbox', { name: new RegExp(CALENDAR) }).check();
  await entry.getByRole('button', { name: 'Guardar' }).click();
  await expect(entry).toContainText(`Funciones extra: ${CALENDAR}`, SERVER_CALL);
  await expect(entry.getByRole('button', { name: 'Guardar' })).toHaveCount(0);

  // La cuenta la ve en su menú sin recargar, sin interruptor: la administración decide
  menu = await openAccountMenu(userPage);
  const features = menu.getByRole('region', { name: 'Funciones extra' });
  await expect(features).toContainText(CALENDAR);
  await expect(features).toContainText('Activadas para tu cuenta por la administración.');
  await expect(features.getByRole('switch')).toHaveCount(0);

  // Al quitarla, desaparece
  await entry.getByRole('button', { name: /^Funciones extra/ }).click();
  await entry.getByRole('checkbox', { name: new RegExp(CALENDAR) }).uncheck();
  await entry.getByRole('button', { name: 'Guardar' }).click();
  await expect(features).toHaveCount(0, SERVER_CALL);
  await expect(entry).not.toContainText('Funciones extra:');

  // Al retirar el acceso se borran: al volver a aprobarla, empieza sin ninguna
  await entry.getByRole('button', { name: /^Funciones extra/ }).click();
  await entry.getByRole('checkbox', { name: new RegExp(CALENDAR) }).check();
  await entry.getByRole('button', { name: 'Guardar' }).click();
  await expect(entry).toContainText(`Funciones extra: ${CALENDAR}`, SERVER_CALL);
  await entry.getByRole('button', { name: /^Retirar acceso/ }).click();
  await expect.poll(() => readDocument(`features/${uid}`), SERVER_CALL).toBeNull();
  await expect(entryIn(adminPage, /^Rechazadas o retiradas/, email)).toBeVisible();
  await expect(
    entryIn(adminPage, /^Rechazadas o retiradas/, email).getByRole('button', { name: /^Funciones extra/ })
  ).toHaveCount(0);
});

test('the admin has every extra feature in their account, switched off until they turn it on', async ({ page }) => {
  await openAdmin(page);
  const adminUid = await uidOf(ADMIN_EMAIL);
  const menu = await openAccountMenu(page);
  const features = menu.getByRole('region', { name: 'Funciones extra' });
  const calendar = features.getByRole('switch', { name: CALENDAR });
  // La cuenta de administración es compartida por la suite: la prueba la deja apagada
  await expect(features).toContainText('Como administración, las tienes todas');
  await expect(calendar).not.toBeChecked();
  await calendar.check();
  await expect(calendar).toBeChecked();
  await expect
    .poll(async () => (await readDocument(`users/${adminUid}`))?.featurePrefs, SERVER_CALL)
    .toEqual({ fields: { googleCalendar: { booleanValue: true } } });
  await calendar.uncheck();
  await expect(calendar).not.toBeChecked();
  await expect
    .poll(async () => (await readDocument(`users/${adminUid}`))?.featurePrefs, SERVER_CALL)
    .toEqual({ fields: { googleCalendar: { booleanValue: false } } });
  // Su propia fila en las solicitudes no tiene el botón: lo suyo se decide aquí
  await menu.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('button', { name: /^Administración/ }).click();
  await expect(entryIn(page, /^Con acceso/, ADMIN_EMAIL).getByRole('button', { name: /^Funciones extra/ })).toHaveCount(
    0
  );
});
