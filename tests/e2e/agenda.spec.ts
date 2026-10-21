import { expect, test } from '@playwright/test';
import { fillAndSaveTask, localDateFromToday, openSection, showMoreOptions, signInWithGoogle } from './helpers';

const longDay = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const dayLabel = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return longDay.format(d);
};

test('agenda shows dated tasks of both lists, projected repetitions, and opens a task to edit it', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Listas', exact: true }).click();

  const work = `Llamar al cliente ${Date.now().toString(36)}`;
  const personal = `Reservar la clase de yoga ${Date.now().toString(36)}`;

  await page.getByRole('button', { name: 'Añadir la primera tarea' }).click();
  await fillAndSaveTask(page, { title: work, dueDate: localDateFromToday(1), dueTime: '10:00' });

  // Con la lista Personal activa, el formulario se abre ya en esa lista
  await page
    .locator('header')
    .getByRole('button', { name: /^Personal/ })
    .click();
  await page.getByRole('button', { name: 'Nueva Tarea' }).click();
  // Semanal desde dentro de dos días, sin fin
  await showMoreOptions(page);
  await page.getByLabel('Repetir').selectOption('WEEKLY');
  await page.getByLabel('Fecha de inicio', { exact: true }).fill(localDateFromToday(2));
  await fillAndSaveTask(page, { title: personal });

  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();

  // Vista por días: cada tarea en su día, con su hora y su lista
  await page.getByRole('button', { name: 'Por días' }).click();
  // Están los 14 días, también hoy aunque no tenga nada
  const todayRegion = page.getByRole('region', { name: new RegExp(dayLabel(0), 'i') });
  await expect(todayRegion).toHaveAttribute('aria-current', 'date');
  await expect(todayRegion).toContainText('Sin nada programado');
  await expect(page.getByRole('region', { name: new RegExp(dayLabel(13), 'i') })).toBeVisible();
  const tomorrow = page.getByRole('region', { name: new RegExp(dayLabel(1), 'i') });
  await expect(tomorrow.getByRole('button', { name: new RegExp(work) })).toContainText('10:00');
  await expect(tomorrow.getByRole('button', { name: new RegExp(work) })).toContainText('Profesional');
  const inTwoDays = page.getByRole('region', { name: new RegExp(dayLabel(2), 'i') });
  await expect(inTwoDays.getByRole('button', { name: new RegExp(personal) })).toContainText('Personal');

  // Vista semanal: la repetición prevista de la tarea semanal aparece una semana después
  await page.getByRole('button', { name: 'Semana', exact: true }).click();
  const projected = page
    .getByRole('listitem', { name: new RegExp(dayLabel(9), 'i') })
    .getByRole('button', { name: new RegExp(personal) });
  // Semanas (de lunes a domingo) que hay que avanzar desde la actual para llegar al día 9
  const weeksAhead = Math.floor((((new Date().getDay() + 6) % 7) + 9) / 7);
  for (let week = 0; week < weeksAhead; week++) {
    await page.getByRole('button', { name: 'Semana siguiente' }).click();
  }
  await expect(projected).toContainText('Repetición prevista');

  // Pulsar una tarea abre el formulario para editarla
  await page.getByRole('button', { name: 'Hoy', exact: true }).click();
  await page.getByRole('button', { name: 'Por días' }).click();
  await tomorrow.getByRole('button', { name: new RegExp(work) }).click();
  await expect(page.getByRole('heading', { name: 'Editar la tarea' })).toBeVisible();
});

test('in the by-days view an overdue task is listed once, under «Vencidas»', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Listas', exact: true }).click();
  const title = `Pagar la factura ${Date.now().toString(36)}`;
  await page.getByRole('button', { name: 'Añadir la primera tarea' }).click();
  await fillAndSaveTask(page, { title, dueDate: localDateFromToday(-1) });

  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  await page.getByRole('button', { name: 'Por días' }).click();
  // La semana anterior incluye el día de vencimiento: la tarea no se repite en ese día
  await page.getByRole('button', { name: 'Semana anterior' }).click();
  await expect(
    page.getByRole('region', { name: /Vencidas/ }).getByRole('button', { name: new RegExp(title) })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(title) })).toHaveCount(1);
});

test('a repeated task with a start and a due date shows only its days, from the start to the due date', async ({
  page
}) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Listas', exact: true }).click();
  const title = `Revisar el correo de clientes ${Date.now().toString(36)}`;
  await page.getByRole('button', { name: 'Añadir la primera tarea' }).click();
  await showMoreOptions(page);
  await page.getByLabel('Repetir').selectOption('WEEKLY');
  // Lunes, miércoles y viernes durante tres semanas desde el lunes de la semana que viene
  const today = new Date();
  const nextMonday = (8 - today.getDay()) % 7 || 7;
  const start = localDateFromToday(nextMonday);
  const end = localDateFromToday(nextMonday + 18); // viernes de la tercera semana
  await page.getByLabel('Fecha de inicio', { exact: true }).fill(start);
  const days = page.locator('fieldset', { hasText: 'Días de la semana' });
  // El lunes ya viene marcado por ser el día del inicio
  await expect(days.getByRole('checkbox', { name: 'Lunes' })).toBeChecked();
  await days.getByText('X', { exact: true }).click();
  await days.getByText('V', { exact: true }).click();
  await page.getByLabel('Fecha límite', { exact: true }).fill(end);
  await expect(page.getByText('fin de la repetición (opcional)')).toBeVisible();
  await expect(page.getByLabel('Hasta (opcional)')).toHaveCount(0);
  await fillAndSaveTask(page, { title });

  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  const countPerDay = async () =>
    page
      .getByRole('list', { name: 'Semana' })
      .locator(':scope > li')
      .evaluateAll(
        (els, t) =>
          els.map((el) => [...el.querySelectorAll('button')].filter((b) => b.textContent?.includes(t)).length),
        title
      );
  await page.getByRole('button', { name: 'Semana siguiente' }).click();
  // Ningún día «En curso»: solo lunes, miércoles y viernes
  await expect.poll(countPerDay).toEqual([1, 0, 1, 0, 1, 0, 0]);
  await page.getByRole('button', { name: 'Semana siguiente' }).click();
  await page.getByRole('button', { name: 'Semana siguiente' }).click();
  await expect.poll(countPerDay).toEqual([1, 0, 1, 0, 1, 0, 0]);
  // La serie termina en la fecha límite
  await page.getByRole('button', { name: 'Semana siguiente' }).click();
  await expect.poll(countPerDay).toEqual([0, 0, 0, 0, 0, 0, 0]);
});

test('on a phone, a title with a long link wraps and the page does not get wider than the screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await signInWithGoogle(page);
  await openSection(page, 'Listas');
  const title = 'Revisar https://deardoc.example/boards/9929382056/views/2108790123456789012345678901234567';
  await page.getByRole('button', { name: 'Añadir la primera tarea' }).click();
  await fillAndSaveTask(page, { title, dueDate: localDateFromToday(0), dueTime: '23:59' });
  const widerBy = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(await widerBy()).toBeLessThanOrEqual(0);

  await openSection(page, 'Agenda');
  await expect(page.getByRole('button', { name: /^23:59 Revisar https/ }).first()).toBeVisible();
  expect(await widerBy()).toBeLessThanOrEqual(0);
  await page.getByRole('button', { name: 'Por días' }).click();
  await expect(page.getByRole('button', { name: /^23:59 Revisar https/ }).first()).toBeVisible();
  expect(await widerBy()).toBeLessThanOrEqual(0);
});
