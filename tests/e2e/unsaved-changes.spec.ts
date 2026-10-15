import { expect, test } from '@playwright/test';
import { fillAndSaveTask, openSection, openTaskActions, signInWithGoogle } from './helpers';

const unique = () => Date.now().toString(36);
const TITLE_FIELD = 'ej. Llamar al proveedor para acordar el plazo de entrega';

test('closing a task form with unsaved changes asks first; Escape keeps editing', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Listas', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Nueva tarea' });
  const prompt = page.getByRole('alertdialog', { name: '¿Descartar los cambios?' });

  // Sin cambios se cierra sin preguntar
  await page.getByRole('button', { name: 'Añadir la primera tarea' }).click();
  await page.keyboard.press('Escape');
  await expect(form).toBeHidden();

  // Con cambios, Escape pregunta; el foco empieza en «Seguir editando» y no sale del aviso
  const title = `Comprar los billetes del viaje ${unique()}`;
  await page.getByRole('button', { name: 'Añadir la primera tarea' }).click();
  await page.getByPlaceholder(TITLE_FIELD).fill(title);
  await page.keyboard.press('Escape');
  await expect(prompt).toContainText('Has empezado una tarea nueva y no la has guardado.');
  await expect(prompt.getByRole('button', { name: 'Seguir editando' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(prompt.getByRole('button', { name: 'Descartar' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(prompt.getByRole('button', { name: 'Seguir editando' })).toBeFocused();

  // Escape sobre el aviso es seguir editando: el formulario sigue igual y el foco vuelve al título
  await page.keyboard.press('Escape');
  await expect(prompt).toBeHidden();
  await expect(page.getByPlaceholder(TITLE_FIELD)).toHaveValue(title);
  await expect(page.getByPlaceholder(TITLE_FIELD)).toBeFocused();

  // «Cancelar» también pregunta; «Descartar» cierra sin guardar
  await form.getByRole('button', { name: 'Cancelar' }).click();
  await prompt.getByRole('button', { name: 'Descartar' }).click();
  await expect(form).toBeHidden();
  await expect(page.getByRole('heading', { name: title })).toHaveCount(0);
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
  await form.getByLabel(/^Meta/).fill(`Correr una media maratón ${unique()}`);
  await page.keyboard.press('Escape');
  const prompt = page.getByRole('alertdialog', { name: '¿Descartar los cambios?' });
  await expect(prompt).toContainText('Has empezado una meta nueva y no la has guardado.');
  await prompt.getByRole('button', { name: 'Descartar' }).click();
  await expect(form).toBeHidden();
});
