import { expect, test } from '@playwright/test';

test('first run opens the Wheel of Life at 0 with a first-step notice and a link to the guide', async ({ page }) => {
  await page.goto('/');

  const notice = page.getByRole('status').filter({ hasText: 'Primer paso: evalúa tu Rueda de la Vida' });
  await expect(notice).toBeVisible();

  const sliders = page.getByRole('slider');
  await expect(sliders).toHaveCount(7);
  for (const slider of await sliders.all()) {
    await expect(slider).toHaveValue('0');
  }

  // No hay perfiles de demostración: solo el perfil local creado al arrancar
  await expect(page.getByText('Perfil: Mi espacio')).toBeVisible();

  await notice.getByRole('button', { name: 'Cómo funciona la app' }).click();
  await expect(page.getByRole('heading', { name: 'Cómo funciona la app' })).toBeVisible();
  await expect(page.getByText('Todo se guarda solo en este navegador.', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Ir a Rueda de la Vida' }).click();
  await page.getByRole('slider', { name: 'Puntuación de Salud' }).fill('7');
  await page.getByRole('button', { name: 'Consolidar Estado' }).click();
  await expect(notice).toBeHidden();

  // Con una evaluación guardada, la app vuelve a abrir en las listas
  await page.reload();
  await expect(page.getByText('Top 10 Operativo & Flujo Activo')).toBeVisible();
  await expect(page.getByText('Primer paso: evalúa tu Rueda de la Vida')).toBeHidden();
});
