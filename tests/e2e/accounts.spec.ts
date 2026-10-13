import { expect, test, type Locator, type Page } from '@playwright/test';
import { approveAccess, emulatorOobCode, uniqueEmail } from './helpers';

// Esperas que pasan por una Cloud Function del emulador: con la suite en paralelo su arranque puede tardar
const SERVER_CALL = { timeout: 15_000 };

const PASSWORD = 'clave-segura-1';

const signUp = async (page: Page, email: string) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Crear una cuenta' }).click();
  await page.getByLabel('Nombre (opcional)').fill('Lucía Prueba');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
};

const signIn = async (page: Page, email: string, password: string) => {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
};

// Cerrar sesión borra la caché local y recarga la página: hay que esperar a la recarga antes de volver a entrar,
// o lo escrito en el formulario de acceso se pierde
const signOutWith = async (page: Page, button: Locator) => {
  const reloaded = page.waitForEvent('load', SERVER_CALL);
  await button.click();
  await reloaded;
};

const openSecurity = async (page: Page) => {
  await page.getByRole('button', { name: 'Tu cuenta' }).click();
  return page.getByRole('dialog', { name: 'Tu cuenta' });
};

test('a new account with email and password confirms its email before asking for access', async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);

  // Sin confirmar el email no puede solicitar acceso
  await expect(page.getByRole('heading', { name: 'Confirma tu email' })).toBeVisible();
  await page.getByRole('button', { name: 'Ya lo he confirmado' }).click();
  await expect(page.getByRole('alert')).toContainText('aún no consta como confirmado');

  // Se abre el enlace del email (el emulador lo guarda) y ya puede solicitar acceso
  const { oobLink } = await emulatorOobCode(email, 'VERIFY_EMAIL');
  expect((await fetch(oobLink)).ok).toBe(true);
  await page.getByRole('button', { name: 'Ya lo he confirmado' }).click();
  await expect(page.getByRole('heading', { name: 'Solicita acceso' })).toBeVisible(SERVER_CALL);
  await page.getByRole('button', { name: 'Solicitar acceso' }).click();
  await expect(page.getByRole('heading', { name: 'Solicitud enviada' })).toBeVisible(SERVER_CALL);

  // Aprobada, entra en la app; al volver a entrar con email y contraseña también
  await approveAccess(email);
  await expect(page.getByRole('button', { name: 'Nueva tarea', exact: true })).toBeVisible();
  const account = await openSecurity(page);
  await expect(account).toContainText('Entras con email y contraseña');
  await signOutWith(page, account.getByRole('button', { name: 'Cerrar sesión', exact: true }));
  await signIn(page, email, PASSWORD);
  await expect(page.getByRole('button', { name: 'Nueva tarea', exact: true })).toBeVisible();
});

test('wrong passwords are rejected and a forgotten password can be reset by email', async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await expect(page.getByRole('heading', { name: 'Confirma tu email' })).toBeVisible();
  await signOutWith(page, page.getByRole('button', { name: 'Cerrar sesión' }));

  await signIn(page, email, 'no-es-esta');
  await expect(page.getByRole('alert')).toHaveText('Email o contraseña incorrectos.');

  await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Enviar el enlace' }).click();
  await expect(page.getByText(/te hemos enviado un enlace para crear una contraseña nueva/)).toBeVisible();

  // El enlace del email permite poner una contraseña nueva
  const { oobCode } = await emulatorOobCode(email, 'PASSWORD_RESET');
  const reset = await fetch('http://127.0.0.1:9399/identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=demo-api-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oobCode, newPassword: 'clave-nueva-22' })
  });
  expect(reset.ok).toBe(true);

  await page.getByRole('button', { name: 'Volver a entrar' }).click();
  await signIn(page, email, PASSWORD);
  await expect(page.getByRole('alert')).toHaveText('Email o contraseña incorrectos.');
  await signIn(page, email, 'clave-nueva-22');
  // Recuperar la contraseña con el enlace del email ya confirma la dirección
  await expect(page.getByRole('heading', { name: 'Solicita acceso' })).toBeVisible(SERVER_CALL);
});

test('the account changes its password, closes every session and deletes itself with its password', async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  const { oobLink } = await emulatorOobCode(email, 'VERIFY_EMAIL');
  await fetch(oobLink);
  await page.getByRole('button', { name: 'Ya lo he confirmado' }).click();
  await approveAccess(email);
  await expect(page.getByRole('button', { name: 'Nueva tarea', exact: true })).toBeVisible();

  // Cambiar la contraseña
  let account = await openSecurity(page);
  await account.getByRole('button', { name: 'Cambiar la contraseña' }).click();
  await account.getByLabel('Contraseña actual').fill(PASSWORD);
  await account.getByLabel('Contraseña nueva').fill('otra-clave-333');
  await account.getByRole('button', { name: 'Guardar la contraseña nueva' }).click();
  await expect(account.getByText('Contraseña cambiada.')).toBeVisible();

  // Cerrar sesión en todos los dispositivos (también en este) y volver a entrar con la nueva
  await account.getByRole('button', { name: 'Cerrar sesión en todos los dispositivos' }).click();
  await signOutWith(page, account.getByRole('button', { name: 'Cerrar todas las sesiones' }));
  await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeVisible();
  await signIn(page, email, 'otra-clave-333');
  await expect(page.getByRole('button', { name: 'Nueva tarea', exact: true })).toBeVisible();

  // Eliminar la cuenta pide la contraseña
  account = await openSecurity(page);
  await account.getByRole('button', { name: 'Eliminar mi cuenta y todos mis datos' }).click();
  await account.getByLabel('Contraseña', { exact: true }).fill('otra-clave-333');
  await signOutWith(page, account.getByRole('button', { name: 'Eliminar definitivamente' }));
  await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeVisible();
  await signIn(page, email, 'otra-clave-333');
  await expect(page.getByRole('alert')).toHaveText('Email o contraseña incorrectos.');
});
