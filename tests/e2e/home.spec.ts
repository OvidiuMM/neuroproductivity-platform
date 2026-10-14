import { expect, test } from '@playwright/test';
import { completeTask, fillAndSaveTask, localDateFromToday, signInWithGoogle } from './helpers';

test('Inicio shows the focus block, task statistics and recommendations for the active list', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Listas', exact: true }).click();

  const overdue = `Pagar la factura del seguro ${Date.now().toString(36)}`;
  const onTime = `Enviar el presupuesto ${Date.now().toString(36)}`;
  await page.getByRole('button', { name: 'Añadir la primera tarea' }).click();
  await fillAndSaveTask(page, { title: overdue, dueDate: localDateFromToday(-1) });
  await page.getByRole('button', { name: 'Nueva tarea', exact: true }).click();
  await fillAndSaveTask(page, { title: onTime, dueDate: localDateFromToday(1), estimateMinutes: 60 });
  await completeTask(page, onTime);

  // El bloque de foco ya no está en las demás secciones
  await expect(page.getByRole('heading', { name: 'Tu foco profesional' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu foco profesional' })).toBeVisible();

  const done = page.getByRole('region', { name: 'Tareas hechas' });
  await expect(done.getByText('Hoy').locator('..')).toContainText('1');
  await expect(page.getByRole('region', { name: 'A tiempo o con retraso' })).toContainText('100 %');
  await expect(page.getByRole('region', { name: 'Constancia y pendientes' })).toContainText('1 vencidas');
  await expect(page.getByRole('region', { name: 'Velocidad' })).toBeVisible();
  await expect(
    page.getByRole('img', { name: /Tareas hechas por día en los últimos 14 días: 1 en total/ })
  ).toBeVisible();

  // La recomendación más urgente es la tarea vencida, con un acceso directo a la agenda
  const recommendations = page.getByRole('region', { name: 'Recomendaciones' });
  await expect(recommendations).toContainText(`Tienes una tarea vencida: «${overdue}»`);
  await recommendations.getByRole('button', { name: 'Ver la agenda' }).click();
  await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();

  // Las estadísticas son de la lista activa: la personal está vacía
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await page
    .locator('header')
    .getByRole('button', { name: /^Personal/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Tu foco personal' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tareas hechas' }).getByText('Hoy').locator('..')).toContainText('0');
});
