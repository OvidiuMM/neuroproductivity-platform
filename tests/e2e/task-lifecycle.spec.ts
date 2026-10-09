import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, fillAndSaveTask, localDateFromToday, signInWithGoogle } from './helpers';

const unique = () => Date.now().toString(36);

test('adds tasks from the button at the end of the list and colors titles by due date', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Listas Duales' }).click();

  const overdue = `Llamar al proveedor vencido ${unique()}`;
  const soon = `Llamar al taller esta semana ${unique()}`;
  const later = `Llamar al banco el mes que viene ${unique()}`;

  await page.getByRole('button', { name: 'Capturar Primera Acción' }).click();
  await fillAndSaveTask(page, { title: overdue, dueDate: localDateFromToday(-1) });

  // Con tareas en la lista, el botón para añadir otra está al final
  await page.getByRole('button', { name: 'Añadir tarea', exact: true }).click();
  await fillAndSaveTask(page, { title: soon, dueDate: localDateFromToday(3), dueTime: '18:00' });
  await page.getByRole('button', { name: 'Añadir tarea', exact: true }).click();
  await fillAndSaveTask(page, { title: later, dueDate: localDateFromToday(30) });

  // Se compara el color calculado, no solo la clase: si conviven dos clases de color, gana la que el CSS defina después
  const colorOfClass = (className: string) =>
    page.evaluate((cls) => {
      const probe = document.createElement('span');
      probe.className = cls;
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    }, className);
  const titleColor = (name: string) =>
    page.getByRole('heading', { name }).evaluate((el) => getComputedStyle(el).color);

  expect(await titleColor(overdue)).toBe(await colorOfClass('text-red-600'));
  expect(await titleColor(soon)).toBe(await colorOfClass('text-violet-600'));
  expect(await titleColor(later)).toBe(await colorOfClass('text-slate-900'));
  await expect(page.getByText('18:00', { exact: false })).toBeVisible();

  // La lista con tareas, fechas y menús tampoco desborda en móvil
  await page.setViewportSize({ width: 375, height: 900 });
  await expectNoHorizontalOverflow(page, 'lista con tareas a 375px');
});

test('archives a task when marked done and reactivates it from the archive', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Listas Duales' }).click();

  const title = `Llamar al cliente para cerrar ${unique()}`;
  await page.getByRole('button', { name: 'Capturar Primera Acción' }).click();
  await fillAndSaveTask(page, { title });
  await expect(page.getByRole('heading', { name: title })).toBeVisible();

  await page.getByLabel(`Estado de «${title}»`).selectOption('DONE');
  await expect(page.getByRole('heading', { name: title })).toBeHidden();

  await page.getByRole('button', { name: /Archivadas/ }).click();
  const archive = page.getByRole('dialog', { name: 'Tareas archivadas' });
  await expect(archive.getByText(title)).toBeVisible();

  await archive.getByLabel(`Estado de «${title}»`).selectOption('IN_PROGRESS');
  await expect(archive.getByText(title)).toBeHidden();
  await archive.getByRole('button', { name: 'Cerrar' }).click();

  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByLabel(`Estado de «${title}»`)).toHaveValue('IN_PROGRESS');
});

test('adds a task with a due date to Google, Outlook or an .ics calendar file', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Listas Duales' }).click();

  const title = `Llamar al notario ${unique()}`;
  await page.getByRole('button', { name: 'Capturar Primera Acción' }).click();
  await fillAndSaveTask(page, { title, dueDate: localDateFromToday(10), dueTime: '10:30' });

  await page.getByRole('button', { name: 'Añadir al calendario', exact: true }).click();
  const menu = page.getByRole('menu');

  const google = new URL((await menu.getByRole('menuitem', { name: 'Google Calendar' }).getAttribute('href'))!);
  expect(google.hostname).toBe('calendar.google.com');
  expect(google.searchParams.get('text')).toBe(title);
  expect(google.searchParams.get('dates')).toMatch(/^\d{8}T\d{6}Z\/\d{8}T\d{6}Z$/);

  const personal = new URL((await menu.getByRole('menuitem', { name: /Outlook\.com/ }).getAttribute('href'))!);
  expect(personal.hostname).toBe('outlook.live.com');
  const work = new URL((await menu.getByRole('menuitem', { name: /Microsoft 365/ }).getAttribute('href'))!);
  expect(work.hostname).toBe('outlook.office.com');

  const downloadPromise = page.waitForEvent('download');
  await menu.getByRole('menuitem', { name: /Descargar \.ics/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.ics$/);
  const ics = readFileSync((await download.path())!, 'utf8');
  expect(ics).toContain('BEGIN:VEVENT');
  expect(ics).toContain(`SUMMARY:${title}`);
});

test('disables the calendar button for tasks without a due date', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Listas Duales' }).click();

  await page.getByRole('button', { name: 'Capturar Primera Acción' }).click();
  await fillAndSaveTask(page, { title: `Llamar al electricista ${unique()}` });

  await expect(page.getByRole('button', { name: 'Añadir al calendario (necesita fecha límite)' })).toBeDisabled();
});
