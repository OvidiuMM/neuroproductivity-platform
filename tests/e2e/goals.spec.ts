import { expect, test } from '@playwright/test';
import { completeTask, fillAndSaveTask, signInWithGoogle } from './helpers';

test('areas → goals → tasks: a goal is created in the Wheel, tasks link to it and its progress shows', async ({
  page
}) => {
  await page.goto('/');
  await signInWithGoogle(page);
  const goalTitle = `Correr una media maratón ${Date.now().toString(36)}`;

  // Crear la meta en la Rueda
  await page.getByRole('button', { name: 'Rueda de la Vida' }).click();
  await page.getByRole('button', { name: 'Nueva meta' }).click();
  const editor = page.getByRole('dialog', { name: 'Nueva meta' });
  await editor.getByRole('button', { name: 'Crear la meta' }).click();
  await expect(editor.getByRole('alert')).toHaveText('Ponle un nombre a la meta.');
  await editor.getByLabel('Meta').fill(goalTitle);
  await editor.getByLabel('Área de la Rueda').selectOption('Salud');
  await editor.getByLabel('¿Para qué?').fill('Llegar en forma a los 40');
  await editor.getByRole('button', { name: 'Crear la meta' }).click();
  await expect(editor).toBeHidden();

  const active = page.getByRole('list', { name: 'Metas activas' });
  await expect(active.getByRole('heading', { name: goalTitle })).toBeVisible();
  await expect(active).toContainText('Aún no tiene tareas vinculadas.');
  await expect(page.getByText('· 1 meta activa')).toBeVisible();
  // «Archivar» también es fácil de pulsar
  const archiveBox = (await active.getByRole('button', { name: 'Archivar' }).boundingBox())!;
  expect(archiveBox.height).toBeGreaterThanOrEqual(44);

  // Una tarea cuyo título comparte palabras con la meta la sugiere; al vincularla hereda el área
  const taskTitle = `Salir a correr para la maratón ${Date.now().toString(36)}`;
  await page.getByRole('button', { name: 'Nueva tarea', exact: true }).click();
  await page.getByPlaceholder('ej. Llamar al proveedor para acordar el plazo de entrega').fill(taskTitle);
  await page.getByRole('button', { name: `Vincular a «${goalTitle}»` }).click();
  await expect(page.getByRole('combobox', { name: /^Meta/ })).toHaveValue(/^goal-/);
  await expect(page.getByText('Área de la Rueda: Salud (la de la meta).')).toBeVisible();
  await fillAndSaveTask(page, { title: taskTitle });

  // La tarjeta muestra la meta, y la meta su progreso
  await page.getByRole('button', { name: 'Listas Duales' }).click();
  const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: taskTitle }) });
  await expect(card).toContainText(goalTitle);
  await completeTask(page, taskTitle);

  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  const goalsCard = page.getByRole('region', { name: 'Metas' });
  await expect(goalsCard).toContainText(goalTitle);
  await expect(goalsCard.getByRole('progressbar', { name: `Progreso de «${goalTitle}»` })).toHaveAttribute(
    'aria-valuetext',
    '1 de 1 tareas hechas'
  );

  // Lograda: pasa a «Logradas y archivadas»
  await page.getByRole('button', { name: 'Rueda de la Vida' }).click();
  await page.getByRole('button', { name: `Marcar «${goalTitle}» como lograda` }).click();
  await expect(active).toBeHidden();
  await page.getByRole('button', { name: 'Logradas y archivadas (1)' }).click();
  await expect(page.getByRole('list', { name: 'Metas logradas y archivadas' })).toContainText('Lograda');

  // Cambiar el área de la meta mueve sus tareas a la nueva; eliminarla las deja sin meta, con esa área
  await page.getByRole('button', { name: 'Listas Duales' }).click();
  await page.getByRole('button', { name: /Archivadas/ }).click();
  const archive = page.getByRole('dialog', { name: 'Tareas archivadas' });
  await archive.getByLabel(`Estado de «${taskTitle}»`).selectOption('PENDING');
  await archive.getByRole('button', { name: 'Cerrar' }).click();
  await expect(card).toContainText(goalTitle);

  await page.getByRole('button', { name: 'Rueda de la Vida' }).click();
  await page.getByRole('button', { name: 'Logradas y archivadas (1)' }).click();
  await page.getByRole('button', { name: `Editar la meta «${goalTitle}»` }).click();
  await page.getByLabel('Área de la Rueda').selectOption('Ocio');
  await page.getByRole('button', { name: 'Guardar los cambios' }).click();
  await page.getByRole('button', { name: `Editar la meta «${goalTitle}»` }).click();
  await page.getByRole('button', { name: 'Eliminar la meta' }).click();
  await page.getByRole('button', { name: 'Eliminar definitivamente' }).click();
  await expect(page.getByRole('heading', { name: goalTitle })).toHaveCount(0);

  await page.getByRole('button', { name: 'Listas Duales' }).click();
  await expect(card).not.toContainText(goalTitle);
  await expect(card).toContainText('Ocio');
});

test('an impossible target date does not let the goal be saved', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Rueda de la Vida' }).click();
  await page.getByRole('button', { name: 'Nueva meta' }).click();
  const editor = page.getByRole('dialog', { name: 'Nueva meta' });
  await editor.getByLabel('Meta').fill('Viajar a Japón');
  await editor.getByLabel('Área de la Rueda').selectOption('Ocio');
  const date = editor.getByLabel('Fecha objetivo', { exact: true });
  await date.fill('31/02/2027');
  await expect(date).toHaveAttribute('aria-invalid', 'true');
  await editor.getByRole('button', { name: 'Crear la meta' }).click();
  await expect(editor).toBeVisible();
  await date.fill('28/02/2027');
  await editor.getByRole('button', { name: 'Crear la meta' }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByRole('list', { name: 'Metas activas' })).toContainText('Para el 28 feb 2027');
});
