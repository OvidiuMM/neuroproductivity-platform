import { expect, test } from '@playwright/test';
import { signInWithGoogle } from './helpers';

test('requires signing in with Google before showing any data', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeVisible();
  await expect(page.getByText('servidores de Google Cloud en la Unión Europea', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nueva Tarea' })).toHaveCount(0);
});

test('first sign-in opens the Wheel of Life at 0 with a first-step notice and a link to the guide', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);

  const notice = page.getByRole('status').filter({ hasText: 'Primer paso: evalúa tu Rueda de la Vida' });
  await expect(notice).toBeVisible();

  const sliders = page.getByRole('slider');
  await expect(sliders).toHaveCount(7);
  for (const slider of await sliders.all()) {
    await expect(slider).toHaveValue('0');
  }

  await notice.getByRole('button', { name: 'Cómo funciona la app' }).click();
  await expect(page.getByRole('heading', { name: 'Cómo funciona la app' })).toBeVisible();
  await expect(page.getByText('Todo se guarda en tu cuenta de Google', { exact: false })).toBeVisible();
  await expect(page.getByText('Esta app no está afiliada ni respaldada por el autor.', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Ir a Rueda de la Vida' }).click();
  await page.getByRole('slider', { name: 'Puntuación de Salud' }).fill('7');
  await page.getByRole('button', { name: 'Consolidar Estado' }).click();
  await expect(notice).toBeHidden();

  // La sesión y la evaluación persisten: al recargar, la app vuelve a abrir en las listas
  await page.reload();
  await expect(page.getByText('Top 10 Operativo & Flujo Activo')).toBeVisible();
  await expect(page.getByText('Primer paso: evalúa tu Rueda de la Vida')).toBeHidden();
});
