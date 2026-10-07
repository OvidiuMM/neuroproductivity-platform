import { expect, test } from '@playwright/test';

test('creates a task and persists it after reloading', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Basado en la metodología de Dr. Jonathan Benito Sipos').first()).toBeVisible();
  await page.getByRole('button', { name: 'Nueva Tarea' }).click();

  const title = `Llamar al proveedor E2E ${Date.now()}`;
  await page.getByPlaceholder('ej. Llamar al proveedor para acordar el plazo de entrega').fill(title);
  await page
    .getByPlaceholder('Detalla el resultado esperado, personas involucradas o requerimientos físicos previos...')
    .fill('Confirmar la fecha y hora de entrega.');
  await page.getByRole('button', { name: 'Guardar Acción Operativa' }).click();

  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
});
