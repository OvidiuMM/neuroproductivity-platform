import { expect, test } from '@playwright/test';
import { signInWithGoogle } from './helpers';

test('offers to import data saved by the version without accounts, then clears it from the browser', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const created = '2026-10-01T09:00:00.000Z';
    localStorage.setItem(
      'neuro_users_v1',
      JSON.stringify([{ id: 'user-ana', name: 'Ana', role: '', color: 'indigo', initials: 'A', authProvider: 'local', createdAt: created }])
    );
    localStorage.setItem(
      'neuro_tasks_v1',
      JSON.stringify([
        {
          id: 'task-local-1',
          userId: 'user-ana',
          listContext: 'WORK',
          title: 'Llamar al taller para pedir presupuesto',
          description: '',
          priority: 'HIGH',
          createdAt: created,
          updatedAt: created,
          observations: [],
          isSomeday: false,
          completed: false
        }
      ])
    );
  });

  await signInWithGoogle(page);

  const dialog = page.getByRole('dialog', { name: 'Importar datos de este navegador' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Ana')).toBeVisible();
  await expect(dialog.getByText('1 tarea')).toBeVisible();

  await dialog.getByRole('button', { name: 'Importar a mi cuenta' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'Listas Duales' }).click();
  await expect(page.getByText('Llamar al taller para pedir presupuesto', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('neuro_tasks_v1'))).toBeNull();

  // Tras recargar no se vuelve a ofrecer la importación y la tarea sigue en la cuenta
  await page.reload();
  await page.getByRole('button', { name: 'Listas Duales' }).click();
  await expect(page.getByText('Llamar al taller para pedir presupuesto', { exact: true })).toBeVisible();
  await expect(dialog).toHaveCount(0);
});
