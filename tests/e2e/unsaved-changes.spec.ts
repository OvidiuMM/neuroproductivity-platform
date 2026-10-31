import { expect, test } from '@playwright/test';
import { fillAndSaveTask, openSection, openTaskActions, signInWithGoogle } from './helpers';

const unique = () => Date.now().toString(36);
const TITLE_FIELD = 'ej. Llamar al proveedor para acordar el plazo de entrega';

test('closing a task form with unsaved changes asks first; Escape keeps editing', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Listas', exact: true }).click();
  const prompt = page.getByRole('alertdialog', { name: '¿Descartar los cambios?' });
  // Una tarea que ya existe (una nueva se guarda sola como borrador: ver drafts.spec.ts)
  const title = `Comprar los billetes del viaje ${unique()}`;
  await page.getByRole('button', { name: 'Añadir la primera tarea' }).click();
  await fillAndSaveTask(page, { title });
  const form = page.getByRole('dialog', { name: 'Editar la tarea' });
  const edit = async () => {
    await openTaskActions(page, title);
    await page.getByRole('button', { name: `Editar «${title}»` }).click();
  };

  // Sin cambios se cierra sin preguntar
  await edit();
  await page.keyboard.press('Escape');
  await expect(form).toBeHidden();

  // Con cambios, Escape pregunta; el foco empieza en «Seguir editando» y no sale del aviso
  await edit();
  await page.getByPlaceholder(TITLE_FIELD).fill(`${title} en tren`);
  await page.keyboard.press('Escape');
  await expect(prompt).toContainText('Has cambiado esta tarea y no has guardado los cambios.');
  await expect(prompt.getByRole('button', { name: 'Seguir editando' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(prompt.getByRole('button', { name: 'Descartar' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(prompt.getByRole('button', { name: 'Seguir editando' })).toBeFocused();

  // Escape sobre el aviso es seguir editando: el formulario sigue igual y el foco vuelve al título
  await page.keyboard.press('Escape');
  await expect(prompt).toBeHidden();
  await expect(page.getByPlaceholder(TITLE_FIELD)).toHaveValue(`${title} en tren`);
  await expect(page.getByPlaceholder(TITLE_FIELD)).toBeFocused();

  // «Cancelar» también pregunta; «Descartar» cierra sin guardar
  await form.getByRole('button', { name: 'Cancelar' }).click();
  await prompt.getByRole('button', { name: 'Descartar' }).click();
  await expect(form).toBeHidden();
  await expect(page.getByRole('heading', { name: `${title} en tren` })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  // Descartar los cambios de una tarea que ya existe no deja borrador
  await expect(page.getByRole('button', { name: /^Borradores/ })).toHaveCount(0);
});

test('editing a task asks before discarding, and saving does not ask', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Listas', exact: true }).click();
  const title = `Revisar el contrato del alquiler ${unique()}`;
  await page.getByRole('button', { name: 'Añadir la primera tarea' }).click();
  await fillAndSaveTask(page, { title });

  const edit = async () => {
    await openTaskActions(page, title);
    await page.getByRole('button', { name: `Editar «${title}»` }).click();
  };
  await edit();
  const form = page.getByRole('dialog', { name: 'Editar la tarea' });
  // Abrir y cerrar sin tocar nada no pregunta
  await form.getByRole('button', { name: 'Cerrar' }).click();
  await expect(form).toBeHidden();

  await edit();
  await page.getByPlaceholder(TITLE_FIELD).fill(`${title} y firmarlo`);
  await form.getByRole('button', { name: 'Cerrar' }).click();
  const prompt = page.getByRole('alertdialog', { name: '¿Descartar los cambios?' });
  await expect(prompt).toContainText('Has cambiado esta tarea y no has guardado los cambios.');
  await prompt.getByRole('button', { name: 'Seguir editando' }).click();
  await form.getByRole('button', { name: 'Guardar los cambios' }).click();
  await expect(form).toBeHidden();
  await expect(prompt).toBeHidden();
  await expect(page.getByRole('heading', { name: `${title} y firmarlo` })).toBeVisible();
});

test('closing the tab with an unsaved form asks the browser to confirm', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Listas', exact: true }).click();
  await page.getByRole('button', { name: 'Añadir la primera tarea' }).click();
  await page.getByPlaceholder(TITLE_FIELD).fill(`Pagar la cuota del gimnasio ${unique()}`);

  const dialog = page.waitForEvent('dialog');
  await page.close({ runBeforeUnload: true });
  const beforeUnload = await dialog;
  expect(beforeUnload.type()).toBe('beforeunload');
  // Quedarse: la pestaña sigue abierta con el formulario
  await beforeUnload.dismiss();
  await expect(page.getByPlaceholder(TITLE_FIELD)).toBeVisible();
});

test('a goal form with unsaved changes also asks before closing', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await openSection(page, 'Metas');
  await page.getByRole('button', { name: 'Nueva meta', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Nueva meta' });
  const goal = `Correr una media maratón ${unique()}`;
  await form.getByLabel(/^Meta/).fill(goal);
  // Que el formulario ya tenga lo escrito antes de cerrarlo (en CI, Escape podía llegar antes)
  await expect(form.getByLabel(/^Meta/)).toHaveValue(goal);
  await page.keyboard.press('Escape');
  const prompt = page.getByRole('alertdialog', { name: '¿Descartar los cambios?' });
  await expect(prompt).toContainText('Has empezado una meta nueva y no la has guardado.');
  await prompt.getByRole('button', { name: 'Descartar' }).click();
  await expect(form).toBeHidden();
});

test('an unfinished or impossible date also counts as a change, in the task and goal forms', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Listas', exact: true }).click();
  const prompt = page.getByRole('alertdialog', { name: '¿Descartar los cambios?' });

  // Solo una fecha a medio escribir en una tarea que ya existe: el valor no cambia, pero lo escrito se perdería
  const title = `Renovar el pasaporte ${unique()}`;
  await page.getByRole('button', { name: 'Añadir la primera tarea' }).click();
  await fillAndSaveTask(page, { title });
  await openTaskActions(page, title);
  await page.getByRole('button', { name: `Editar «${title}»` }).click();
  await page.getByLabel('Fecha límite', { exact: true }).fill('20/10/');
  await page.keyboard.press('Escape');
  await expect(prompt).toBeVisible();
  await prompt.getByRole('button', { name: 'Seguir editando' }).click();
  // También al cerrar la pestaña
  const dialog = page.waitForEvent('dialog');
  await page.close({ runBeforeUnload: true });
  const beforeUnload = await dialog;
  expect(beforeUnload.type()).toBe('beforeunload');
  await beforeUnload.dismiss();
  await page.keyboard.press('Escape');
  await prompt.getByRole('button', { name: 'Descartar' }).click();

  // En la meta, una fecha imposible
  await openSection(page, 'Metas');
  await page.getByRole('button', { name: 'Nueva meta', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Nueva meta' })
    .getByLabel('Fecha objetivo', { exact: true })
    .fill('31/02/2027');
  await page.keyboard.press('Escape');
  await expect(prompt).toContainText('Has empezado una meta nueva y no la has guardado.');
});
