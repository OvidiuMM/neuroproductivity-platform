import { expect, test } from '@playwright/test';
import {
  ADMIN_EMAIL,
  callFunction,
  createVerifiedAccount,
  readDocument,
  signInWithGoogle,
  writeTextDocument
} from './helpers';

// Cambia la configuración global de la app: este archivo va en su propio proyecto de Playwright, después de los demás
test.describe.configure({ mode: 'serial' });

const SERVER_CALL = { timeout: 15_000 };

const statusOf = async (response: Response) =>
  ((await response.json()) as { result: { status: string } }).result.status;

// Una cuenta con el email confirmado cuya solicitud se rechazó hace dos días: ya puede volver a pedir acceso
const rejectedAccount = async () => {
  const account = await createVerifiedAccount();
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  await writeTextDocument(`access/${account.uid}`, {
    status: 'rejected',
    email: account.email,
    name: '',
    photoUrl: '',
    message: '',
    requestedAt: twoDaysAgo,
    decidedAt: twoDaysAgo
  });
  return account;
};

test('without mandatory approval, pending requests are approved and new accounts get in on their own', async ({
  browser
}) => {
  // Una solicitud pendiente
  const pending = await browser.newPage();
  await pending.goto('/');
  await signInWithGoogle(pending, undefined, undefined, { approve: false });
  await pending.getByRole('button', { name: 'Solicitar acceso' }).click(SERVER_CALL);
  await expect(pending.getByRole('heading', { name: 'Solicitud enviada' })).toBeVisible(SERVER_CALL);
  // Dos cuentas rechazadas: una vuelve a pedir acceso antes de desactivar la aprobación y la otra, después
  const [early, late] = await Promise.all([rejectedAccount(), rejectedAccount()]);
  expect(await statusOf(await callFunction('requestAccess', early.idToken, { message: '' }))).toBe('pending');

  // La administración desactiva la aprobación (con confirmación)
  const admin = await browser.newPage();
  await admin.goto('/');
  await signInWithGoogle(admin, ADMIN_EMAIL);
  await admin.getByRole('button', { name: /^Administración/ }).click();
  const toggle = admin.getByRole('switch', { name: 'Aprobación obligatoria' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true', SERVER_CALL);
  await toggle.click();
  await expect(admin.getByRole('alert')).toContainText('También se aprobará');
  await admin.getByRole('button', { name: 'Desactivar la aprobación' }).click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false', SERVER_CALL);

  try {
    // La pendiente entra sin recargar
    await expect(pending.getByRole('button', { name: 'Nueva tarea', exact: true })).toBeVisible(SERVER_CALL);

    // Las rechazadas que vuelven a pedir acceso esperan a la administración: ni al desactivarla, ni al entrar, ni al
    // pedirlo otra vez
    expect(await statusOf(await callFunction('requestAccess', late.idToken, { message: '' }))).toBe('pending');
    for (const { idToken, uid } of [early, late]) {
      expect(await statusOf(await callFunction('syncAccess', idToken, {}))).toBe('pending');
      expect(await statusOf(await callFunction('requestAccess', idToken, { message: '' }))).toBe('pending');
      expect(await readDocument(`access/${uid}`)).toMatchObject({ status: 'pending', review: true });
    }

    // Una cuenta nueva entra directamente, sin pantalla de solicitud…
    await admin.getByRole('button', { name: 'Inicio', exact: true }).click();
    const newcomer = await browser.newPage();
    await newcomer.goto('/');
    await signInWithGoogle(newcomer, undefined, undefined, { approve: false });
    await expect(newcomer.getByRole('button', { name: 'Nueva tarea', exact: true })).toBeVisible(SERVER_CALL);

    // …y la administración lo ve en rojo hasta mirar las solicitudes, donde sale como nueva
    const adminTab = admin.getByRole('button', { name: /^Administración/ });
    await expect(adminTab).toHaveAccessibleName('Administración, 1 pendiente', SERVER_CALL);
    await adminTab.click();
    await expect(admin.getByRole('button', { name: 'Solicitudes' })).toBeVisible();
    await expect(admin.getByText('Nueva', { exact: true })).toHaveCount(1);
    await expect(adminTab).toHaveAccessibleName('Administración');
  } finally {
    // Se vuelve a la aprobación obligatoria pase lo que pase
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true', SERVER_CALL);
  }

  // De nuevo obligatoria: otra cuenta nueva tiene que pedir acceso
  const later = await browser.newPage();
  await later.goto('/');
  await signInWithGoogle(later, undefined, undefined, { approve: false });
  await expect(later.getByRole('heading', { name: 'Solicita acceso' })).toBeVisible(SERVER_CALL);
});
