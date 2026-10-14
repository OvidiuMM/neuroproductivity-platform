import { expect, test } from '@playwright/test';
import { readDocument, signInWithGoogle, uidOf } from './helpers';

test('a new account sees the welcome once: why, the method and how to start', async ({ page }) => {
  await page.goto('/');
  const email = await signInWithGoogle(page, undefined, undefined, { onboarded: false });

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Te damos la bienvenida a CLAR' })).toBeVisible();
  await expect(dialog).toContainText('Paso 1 de 3: Por qué');

  // Cada pantalla pone el foco en su título
  await dialog.getByRole('button', { name: 'Siguiente' }).click();
  await expect(dialog.getByRole('heading', { name: 'Así funciona' })).toBeFocused();
  await expect(
    dialog.getByRole('list', { name: 'De tus áreas de vida a lo que haces hoy' }).getByRole('listitem')
  ).toHaveText([/Áreas de vida/, /Metas/, /Tareas/, /Top 10 y Agenda/]);
  await dialog.getByRole('button', { name: 'Atrás' }).click();
  await expect(dialog.getByRole('heading', { name: 'Te damos la bienvenida a CLAR' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Siguiente' }).click();
  await dialog.getByRole('button', { name: 'Siguiente' }).click();
  await expect(dialog.getByRole('heading', { name: 'Tu rutina en tres pasos' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Empezar' }).click();
  await expect(dialog).toBeHidden();

  // Debajo seguía la app: el primer paso es evaluar la Rueda
  await expect(page.getByText('Primer paso: evalúa tu Rueda de la Vida')).toBeVisible();

  // Queda en el perfil, para cualquier dispositivo, y no vuelve a salir
  await expect
    .poll(async () => (await readDocument(`users/${await uidOf(email)}`))?.onboardingOutcome)
    .toBe('completed');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Nueva tarea', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Escape skips the welcome and it is not shown again', async ({ page }) => {
  await page.goto('/');
  const email = await signInWithGoogle(page, undefined, undefined, { onboarded: false });
  await expect(page.getByRole('heading', { name: 'Te damos la bienvenida a CLAR' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(async () => (await readDocument(`users/${await uidOf(email)}`))?.onboardingOutcome).toBe('skipped');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Nueva tarea', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
