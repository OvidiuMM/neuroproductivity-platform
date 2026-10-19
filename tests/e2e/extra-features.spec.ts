import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  ADMIN_EMAIL,
  approveAccess,
  callFunction,
  createVerifiedAccount,
  patchDocument,
  readDocument,
  signInWithGoogle,
  uidOf,
  uniqueEmail
} from './helpers';

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
  test.slow(); // Dos cuentas y muchas llamadas a las Cloud Functions del emulador
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
  const featuresButton = entry.getByRole('button', { name: /^Funciones extra/ });
  const panel = entry.getByRole('group', { name: /^Funciones extra de / });
  // Escape cierra el panel sin guardar y el foco vuelve a su botón
  await featuresButton.click();
  await expect(featuresButton).toHaveAttribute('aria-expanded', 'true');
  await panel.getByRole('checkbox', { name: CALENDAR }).check();
  await adminPage.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(featuresButton).toBeFocused();

  await featuresButton.click();
  await expect(panel.getByRole('checkbox', { name: CALENDAR })).not.toBeChecked();
  await panel.getByRole('checkbox', { name: CALENDAR }).check();
  await panel.getByRole('button', { name: 'Guardar' }).click();
  await expect(entry).toContainText(`Funciones extra: ${CALENDAR}`, SERVER_CALL);
  await expect(panel).toHaveCount(0);
  await expect(featuresButton).toBeFocused();

  // La cuenta la ve en su menú sin recargar, sin interruptor: la administración decide
  menu = await openAccountMenu(userPage);
  const features = menu.getByRole('region', { name: 'Funciones extra' });
  await expect(features).toContainText(CALENDAR);
  await expect(features).toContainText('Activadas para tu cuenta por la administración.');
  await expect(features.getByRole('switch')).toHaveCount(0);

  // Al quitarla, desaparece (y sin funciones no queda documento)
  await featuresButton.click();
  await panel.getByRole('checkbox', { name: CALENDAR }).uncheck();
  await panel.getByRole('button', { name: 'Guardar' }).click();
  await expect(features).toHaveCount(0, SERVER_CALL);
  await expect(entry).not.toContainText('Funciones extra:');
  expect(await readDocument(`features/${uid}`)).toBeNull();

  // Al retirar el acceso se borran, también con el panel abierto: al volver a aprobarla, empieza sin ninguna
  await featuresButton.click();
  await panel.getByRole('checkbox', { name: CALENDAR }).check();
  await panel.getByRole('button', { name: 'Guardar' }).click();
  await expect(entry).toContainText(`Funciones extra: ${CALENDAR}`, SERVER_CALL);
  await featuresButton.click();
  await panel.getByRole('checkbox', { name: CALENDAR }).uncheck();
  await entry.getByRole('button', { name: /^Retirar acceso/ }).click();
  await expect.poll(() => readDocument(`features/${uid}`), SERVER_CALL).toBeNull();
  const closed = entryIn(adminPage, /^Rechazadas o retiradas/, email);
  await expect(closed.getByRole('button', { name: /^Funciones extra/ })).toHaveCount(0);
  await closed.getByRole('button', { name: /^Aprobar/ }).click();
  await expect(featuresButton).toHaveAttribute('aria-expanded', 'false', SERVER_CALL);
  await expect(panel).toHaveCount(0);
  await expect(entry).not.toContainText('Funciones extra:');
});

test('only the admin can set extra features, and deleting the account removes them', async () => {
  const { email, uid, idToken } = await createVerifiedAccount();
  await approveAccess(email);
  // Una cuenta que no es administración no puede concederse nada
  expect((await callFunction('setFeatures', idToken, { uid, features: ['googleCalendar'] })).status).toBe(403);
  expect(await readDocument(`features/${uid}`)).toBeNull();
  // Al eliminar la cuenta, sus funciones extra se borran con ella
  await patchDocument(`features/${uid}`, { granted: { arrayValue: { values: [{ stringValue: 'googleCalendar' }] } } });
  expect((await callFunction('forgetAccess', idToken, {})).status).toBe(200);
  expect(await readDocument(`features/${uid}`)).toBeNull();
});

test('the admin has every extra feature in their account, switched off until they turn it on', async ({ page }) => {
  await openAdmin(page);
  // La cuenta de administración es compartida por la suite (y por las ejecuciones con los emuladores abiertos): se
  // empieza sin nada encendido y la prueba lo deja apagado
  const adminUid = await uidOf(ADMIN_EMAIL);
  await patchDocument(`users/${adminUid}`, { featurePrefs: { mapValue: { fields: {} } } });
  const menu = await openAccountMenu(page);
  const features = menu.getByRole('region', { name: 'Funciones extra' });
  const calendar = features.getByRole('switch', { name: CALENDAR });
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
