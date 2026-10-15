import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { completeTask, fillAndSaveTask, openTaskActions, showMoreOptions, signInWithGoogle } from './helpers';

const pad = (n: number) => String(n).padStart(2, '0');
const toDateString = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateFormat = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

// Segundo lunes de un mes
const secondMonday = (year: number, month: number) => {
  const first = new Date(year, month, 1);
  return new Date(year, month, 1 + ((1 - first.getDay() + 7) % 7) + 7);
};

// Próximo 2.º lunes: el de este mes si aún no ha pasado, o el del siguiente
const nextSecondMonday = (today: Date) => {
  const thisMonth = secondMonday(today.getFullYear(), today.getMonth());
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return thisMonth < startOfToday ? secondMonday(today.getFullYear(), today.getMonth() + 1) : thisMonth;
};

test('a task repeated on the second Monday of every month creates its next occurrence when done', async ({ page }) => {
  // Próximo 2.º lunes (de este mes o del siguiente) y el del mes siguiente a ese
  const due = nextSecondMonday(new Date());
  const next = secondMonday(due.getFullYear(), due.getMonth() + 1);

  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Listas', exact: true }).click();

  const title = `Preparar el informe mensual ${Date.now().toString(36)}`;
  await page.getByRole('button', { name: 'Añadir la primera tarea' }).click();
  // Al repetir, «Inicio» es desde cuándo se repite y ancla la regla (el 2.º lunes)
  await showMoreOptions(page);
  await page.getByLabel('Repetir').selectOption('MONTHLY');
  await page.getByLabel('Fecha de inicio', { exact: true }).fill(toDateString(due));
  await page.getByRole('radio', { name: 'El 2.º lunes' }).check();
  // El formulario resume la regla y la próxima fecha
  await expect(page.getByRole('status').filter({ hasText: 'Cada mes, el 2.º lunes' })).toContainText(
    dateFormat.format(next)
  );
  await fillAndSaveTask(page, { title });

  await expect(page.getByText('Cada mes, el 2.º lunes').first()).toBeVisible();

  // El .ics exporta la serie completa
  await openTaskActions(page, title);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Descargar \.ics/ }).click();
  const ics = readFileSync(await (await downloadPromise).path(), 'utf8');
  expect(ics).toContain('RRULE:FREQ=MONTHLY;INTERVAL=1;BYDAY=2MO');

  // Al marcarla Hecha, se archiva y aparece la siguiente con la fecha del 2.º lunes del mes siguiente
  await completeTask(page, title);
  await expect(page.getByText(`Vence: ${dateFormat.format(next)}`)).toBeVisible();
  await expect(page.getByRole('heading', { name: title })).toHaveCount(1);
  await openTaskActions(page, title);
  await expect(page.getByLabel(`Estado de «${title}»`)).toHaveValue('PENDING');
  await page.keyboard.press('Escape');

  // «Deshacer» devuelve la tarea y quita la repetición creada; volver a marcarla la crea de nuevo
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByText(`Vence: ${dateFormat.format(next)}`)).toBeHidden();
  await expect(page.getByText(`Vence: ${dateFormat.format(due)}`)).toBeVisible();
  await completeTask(page, title);
  await expect(page.getByText(`Vence: ${dateFormat.format(next)}`)).toBeVisible();

  // Reactivar la archivada y volver a completarla no crea una repetición duplicada
  await page.getByRole('button', { name: /Archivadas/ }).click();
  const archive = page.getByRole('dialog', { name: 'Tareas archivadas' });
  await archive.getByLabel(`Estado de «${title}»`).selectOption('PENDING');
  await archive.getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByRole('heading', { name: title })).toHaveCount(2);
  await page
    .getByRole('button', { name: `Marcar «${title}» como hecha` })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: title })).toHaveCount(1);
});

test('turning repetition off keeps the first repetition as the due date, without an interval', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Listas', exact: true }).click();
  await page.getByRole('button', { name: 'Añadir la primera tarea' }).click();
  await showMoreOptions(page);
  await page.getByLabel('Repetir').selectOption('WEEKLY');
  const start = new Date();
  start.setDate(start.getDate() + 3);
  await page.getByLabel('Fecha de inicio', { exact: true }).fill(toDateString(start));
  await page.getByLabel('Repetir').selectOption('');
  const pad2 = (n: number) => String(n).padStart(2, '0');
  await expect(page.getByLabel('Fecha límite', { exact: true })).toHaveValue(
    `${pad2(start.getDate())}/${pad2(start.getMonth() + 1)}/${start.getFullYear()}`
  );
  await expect(page.getByLabel('Fecha de inicio', { exact: true })).toHaveValue('');
  const title = `Revisar el informe ${Date.now().toString(36)}`;
  await fillAndSaveTask(page, { title });
  await expect(
    page.getByText(`Vence: ${dateFormat.format(start).replace(/ \d{4}$/, '')}`, { exact: false }).first()
  ).toBeVisible();
});

test('editing a repetition that fell on a shorter month keeps the series day', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Listas', exact: true }).click();
  // Cada mes el día 31, desde el 31 de enero del año que viene: la de febrero cae en su último día (28 o 29)
  const year = new Date().getFullYear() + 1;
  const endOfFebruary = new Date(year, 2, 0);
  const title = `Pagar el alquiler ${Date.now().toString(36)}`;
  await page.getByRole('button', { name: 'Añadir la primera tarea' }).click();
  await showMoreOptions(page);
  await page.getByLabel('Repetir').selectOption('MONTHLY');
  await page.getByLabel('Fecha de inicio', { exact: true }).fill(`${year}-01-31`);
  await fillAndSaveTask(page, { title });
  await completeTask(page, title);
  await expect(
    page.getByText(dateFormat.format(endOfFebruary).replace(/ \d{4}$/, ''), { exact: false }).first()
  ).toBeVisible();

  // Abrir y guardar la de febrero sin cambios no mueve la serie a su último día
  await openTaskActions(page, title);
  await page.getByRole('button', { name: `Editar «${title}»` }).click();
  await expect(page.getByRole('radio', { name: 'El día 31' })).toBeChecked();
  await page.getByRole('button', { name: 'Guardar los cambios' }).click();
  await expect(page.getByRole('button', { name: 'Guardar los cambios' })).toBeHidden();
  await completeTask(page, title);
  await expect(
    page.getByText(dateFormat.format(new Date(year, 2, 31)).replace(/ \d{4}$/, ''), { exact: false }).first()
  ).toBeVisible();
});

test('cancelling one repetition archives it as cancelled and creates the next one', async ({ page }) => {
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Listas', exact: true }).click();

  const title = `Regar las plantas ${Date.now().toString(36)}`;
  await page.getByRole('button', { name: 'Añadir la primera tarea' }).click();
  await showMoreOptions(page);
  await page.getByLabel('Repetir').selectOption('DAILY');
  await page.getByLabel('Fecha de inicio', { exact: true }).fill(toDateString(today));
  await fillAndSaveTask(page, { title });

  await openTaskActions(page, title);
  await page.getByLabel(`Estado de «${title}»`).selectOption('CANCELLED');
  await expect(page.getByText(/^Tarea cancelada y archivada\. Siguiente repetición:/)).toBeVisible();
  // La serie sigue: la siguiente repetición, mañana
  await expect(page.getByRole('heading', { name: title })).toHaveCount(1);
  await expect(page.getByText(`Vence: ${dateFormat.format(tomorrow)}`)).toBeVisible();
});
