import { expect, test } from '@playwright/test';
import { signInWithGoogle } from './helpers';

test('requires signing in with Google before showing any data', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeVisible();
  await expect(page.getByText('servidores de Google Cloud en la Unión Europea', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nueva Tarea' })).toHaveCount(0);
});

test('first sign-in opens the Wheel of Life at 0 with a first-step notice and a link to the guide', async ({
  page
}) => {
  await page.goto('/');
  await signInWithGoogle(page);

  const notice = page.getByRole('status').filter({ hasText: 'Primer paso: evalúa tu Rueda de la Vida' });
  await expect(notice).toBeVisible();

  const sliders = page.getByRole('slider');
  await expect(sliders).toHaveCount(7);
  for (const slider of await sliders.all()) {
    await expect(slider).toHaveValue('0');
  }

  await notice.getByRole('button', { name: 'Ver la ayuda' }).click();
  await expect(page.getByRole('heading', { name: 'Ayuda', level: 2 })).toBeVisible();
  await expect(page.getByText('Todo se guarda en tu cuenta de CLAR', { exact: false })).toBeVisible();
  await expect(page.getByText('Esta app no está afiliada ni respaldada por el autor.', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Ir a Rueda de la Vida' }).click();
  await page.getByRole('slider', { name: 'Puntuación de Salud' }).fill('7');
  await page.getByRole('button', { name: 'Consolidar Estado' }).click();
  await expect(notice).toBeHidden();

  // La sesión y la evaluación persisten: al recargar, la app vuelve a abrir en Inicio
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Foco de Concentración Profesional' })).toBeVisible();
  await expect(page.getByText('Primer paso: evalúa tu Rueda de la Vida')).toBeHidden();
});

test('the first-run jump to the Wheel never pulls the person out of a section they already opened', async ({
  page
}) => {
  await page.goto('/');
  await signInWithGoogle(page);
  // Respuestas de Firestore retrasadas: la confirmación del servidor llega después de abrir otra sección
  await page.route('**/google.firestore.v1.Firestore/Listen/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    await route.continue().catch(() => {});
  });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Tu cuenta' })).toBeVisible();
  await page.getByRole('button', { name: 'Listas Duales' }).click();
  await expect(page.locator('header [data-sync-status]')).toHaveAttribute('data-sync-status', 'synced', {
    timeout: 20_000
  });
  await expect(page.getByRole('button', { name: 'Listas Duales' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: 'Capturar Primera Acción' })).toBeVisible();
});
