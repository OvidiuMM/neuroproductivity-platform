import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { fillAndSaveTask, signInWithGoogle } from './helpers';

const pad = (n: number) => String(n).padStart(2, '0');
const toDateString = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateFormat = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

// Segundo lunes de un mes
const secondMonday = (year: number, month: number) => {
  const first = new Date(year, month, 1);
  return new Date(year, month, 1 + ((1 - first.getDay() + 7) % 7) + 7);
};

test('a task repeated on the second Monday of every month creates its next occurrence when done', async ({ page }) => {
  // Próximo 2.º lunes (de este mes o del siguiente) y el del mes siguiente a ese
  const today = new Date();
  let due = secondMonday(today.getFullYear(), today.getMonth());
  if (due < new Date(today.getFullYear(), today.getMonth(), today.getDate())) due = secondMonday(today.getFullYear(), today.getMonth() + 1);
  const next = secondMonday(due.getFullYear(), due.getMonth() + 1);

  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Listas Duales' }).click();

  const title = `Preparar el informe mensual ${Date.now().toString(36)}`;
  await page.getByRole('button', { name: 'Capturar Primera Acción' }).click();
  await page.getByLabel('Fecha límite', { exact: true }).fill(toDateString(due));
  await page.getByLabel('Repetir').selectOption('MONTHLY');
  await page.getByRole('radio', { name: 'El 2.º lunes' }).check();
  // El formulario resume la regla y la próxima fecha
  await expect(page.getByRole('status').filter({ hasText: 'Cada mes, el 2.º lunes' })).toContainText(dateFormat.format(next));
  await fillAndSaveTask(page, { title });

  await expect(page.getByText('Cada mes, el 2.º lunes').first()).toBeVisible();

  // El .ics exporta la serie completa
  await page.getByRole('button', { name: `Añadir «${title}» al calendario`, exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: /Descargar \.ics/ }).click();
  const ics = readFileSync((await (await downloadPromise).path())!, 'utf8');
  expect(ics).toContain('RRULE:FREQ=MONTHLY;INTERVAL=1;BYDAY=2MO');
  await page.keyboard.press('Escape');
  await page.mouse.click(5, 400);

  // Al marcarla Hecha, se archiva y aparece la siguiente con la fecha del 2.º lunes del mes siguiente
  await page.getByLabel(`Estado de «${title}»`).selectOption('DONE');
  await expect(page.getByText(`Vence: ${dateFormat.format(next)}`)).toBeVisible();
  await expect(page.getByRole('heading', { name: title })).toHaveCount(1);
  await expect(page.getByLabel(`Estado de «${title}»`)).toHaveValue('PENDING');

  // Reactivar la archivada y volver a completarla no crea una repetición duplicada
  await page.getByRole('button', { name: /Archivadas/ }).click();
  const archive = page.getByRole('dialog', { name: 'Tareas archivadas' });
  await archive.getByLabel(`Estado de «${title}»`).selectOption('PENDING');
  await archive.getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByRole('heading', { name: title })).toHaveCount(2);
  await page.getByLabel(`Estado de «${title}»`).first().selectOption('DONE');
  await expect(page.getByRole('heading', { name: title })).toHaveCount(1);
});
