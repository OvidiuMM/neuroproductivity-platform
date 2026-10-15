import { expect, test, type Page } from '@playwright/test';
import { completeTask, fillAndSaveTask, openTaskActions, showMoreOptions, signInWithGoogle } from './helpers';

const unique = () => Date.now().toString(36);

// Crea una tarea que espera a otra («Empieza después de», en «Más opciones»)
const addDependentTask = async (page: Page, title: string, after: string) => {
  await page.getByRole('button', { name: 'Nueva Tarea' }).click();
  await showMoreOptions(page);
  await page.getByLabel(/^Empieza después de/).selectOption({ label: after });
  await fillAndSaveTask(page, { title });
};

test('tasks that wait for another are blocked until it is done, in parallel, and come back on undo', async ({
  page
}) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Listas', exact: true }).click();
  const stamp = unique();
  const first = `Pedir el presupuesto ${stamp}`;
  const sign = `Firmar el contrato ${stamp}`;
  const order = `Encargar el material ${stamp}`;

  await page.getByRole('button', { name: 'Añadir la primera tarea' }).click();
  await fillAndSaveTask(page, { title: first });
  await addDependentTask(page, sign, first);
  await addDependentTask(page, order, first);

  // Las dos esperan a la primera: con candado, fuera del Top 10 y sin poder marcarlas como hechas
  const top10 = page.getByRole('list', { name: 'Top 10' });
  const rest = page.getByRole('list', { name: /^Posición \d+ en adelante$/ });
  for (const title of [sign, order]) {
    await expect(top10.getByText(title)).toHaveCount(0);
    await expect(rest.getByRole('listitem').filter({ hasText: title })).toContainText(`Bloqueada: espera a «${first}»`);
    await expect(page.getByRole('button', { name: `Marcar «${title}» como hecha` })).toHaveCount(0);
  }
  await expect(top10.getByText(first)).toBeVisible();
  await openTaskActions(page, sign);
  const status = page.getByLabel(`Estado de «${sign}»`);
  await expect(status.getByRole('option', { name: 'Hecha (bloqueada)' })).toBeDisabled();
  await expect(status.getByRole('option', { name: 'En progreso (bloqueada)' })).toBeDisabled();
  await page.keyboard.press('Escape');

  // Al hacer la primera, las dos se desbloquean a la vez
  await completeTask(page, first);
  await expect(page.getByText(/Ya puedes empezar 2 tareas que esperaban a esta\.$/)).toBeVisible();
  for (const title of [sign, order]) {
    await expect(top10.getByText(title)).toBeVisible();
    await expect(page.getByRole('button', { name: `Marcar «${title}» como hecha` })).toBeVisible();
  }

  // «Deshacer» la reabre y vuelven a esperar
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(top10.getByText(first)).toBeVisible();
  await expect(page.getByText(`Bloqueada: espera a «${first}»`)).toHaveCount(2);
});

test('a task cannot wait for one that already waits for it', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Listas', exact: true }).click();
  const stamp = unique();
  const first = `Revisar los planos ${stamp}`;
  const second = `Pedir la licencia de obra ${stamp}`;
  await page.getByRole('button', { name: 'Añadir la primera tarea' }).click();
  await fillAndSaveTask(page, { title: first });
  await addDependentTask(page, second, first);

  // Al editar la primera, la segunda (que espera a ella) no se puede elegir, y se dice que espera
  await openTaskActions(page, first);
  await page.getByRole('button', { name: `Editar «${first}»` }).click();
  await showMoreOptions(page);
  const dependsOn = page.getByLabel(/^Empieza después de/);
  await expect(dependsOn.getByRole('option', { name: second })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Editar la tarea' })).toContainText(
    `Esperan a esta tarea: «${second}».`
  );
});
