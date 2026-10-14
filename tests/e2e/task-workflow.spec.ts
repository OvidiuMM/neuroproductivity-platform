import { expect, test } from '@playwright/test';
import { showMoreOptions, signInWithGoogle } from './helpers';

test('creates a task and persists it after reloading', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);

  await expect(page.getByText('Decide qué hacer ahora, con claridad').first()).toBeVisible();
  // El nombre del autor solo aparece en los créditos de la guía, nunca en las pantallas principales
  await expect(page.getByText(/Benito Sipos/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Nueva Tarea' }).click();

  const title = `Llamar al proveedor E2E ${Date.now()}`;
  await page.getByPlaceholder('ej. Llamar al proveedor para acordar el plazo de entrega').fill(title);
  await showMoreOptions(page);
  await page
    .getByPlaceholder('Detalla el resultado esperado, personas involucradas o requerimientos físicos previos...')
    .fill('Confirmar la fecha y hora de entrega.');
  await page
    .getByPlaceholder('Detalla el resultado esperado, personas involucradas o requerimientos físicos previos...')
    .press('Tab');
  await expect(page.getByText('Sugerencia:')).toBeVisible();

  const saveButton = page.getByRole('button', { name: 'Guardar la tarea' });
  await saveButton.scrollIntoViewIfNeeded();
  await saveButton.click();

  // Una cuenta sin evaluaciones abre en la Rueda de la Vida; las tareas están en Listas
  await page.getByRole('button', { name: 'Listas', exact: true }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Listas', exact: true }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
});
