import { expect, test } from '@playwright/test';
import { signInWithGoogle } from './helpers';

test('creates a task and persists it after reloading', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);

  await expect(page.getByText('Basado en la metodología de Dr. Jonathan Benito Sipos').first()).toBeVisible();
  await page.getByRole('button', { name: 'Nueva Tarea' }).click();

  const title = `Llamar al proveedor E2E ${Date.now()}`;
  await page.getByPlaceholder('ej. Llamar al proveedor para acordar el plazo de entrega').fill(title);
  await page
    .getByPlaceholder('Detalla el resultado esperado, personas involucradas o requerimientos físicos previos...')
    .fill('Confirmar la fecha y hora de entrega.');
  await page
    .getByPlaceholder('Detalla el resultado esperado, personas involucradas o requerimientos físicos previos...')
    .press('Tab');
  await expect(page.getByText('Sugerencia NLP TF-IDF:')).toBeVisible();

  const saveButton = page.getByRole('button', { name: 'Guardar Acción Operativa' });
  await saveButton.scrollIntoViewIfNeeded();
  await saveButton.click();

  // Una cuenta sin evaluaciones abre en la Rueda de la Vida; las tareas están en Listas Duales
  await page.getByRole('button', { name: 'Listas Duales' }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Listas Duales' }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
});
