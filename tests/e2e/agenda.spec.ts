import { expect, test } from '@playwright/test';
import { fillAndSaveTask, localDateFromToday, signInWithGoogle } from './helpers';

const longDay = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const dayLabel = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return longDay.format(d);
};

test('agenda shows dated tasks of both lists, projected repetitions, and opens a task to edit it', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Listas Duales' }).click();

  const work = `Llamar al cliente ${Date.now().toString(36)}`;
  const personal = `Reservar la clase de yoga ${Date.now().toString(36)}`;

  await page.getByRole('button', { name: 'Capturar Primera Acción' }).click();
  await fillAndSaveTask(page, { title: work, dueDate: localDateFromToday(1), dueTime: '10:00' });

  // Con la lista Personal activa, el formulario se abre ya en esa lista
  await page.locator('header').getByRole('button', { name: /^Personal/ }).click();
  await page.getByRole('button', { name: 'Nueva Tarea' }).click();
  await page.getByLabel('Fecha límite', { exact: true }).fill(localDateFromToday(2));
  await page.getByLabel('Repetir').selectOption('WEEKLY');
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
  const projected = page.getByRole('listitem', { name: new RegExp(dayLabel(9), 'i') }).getByRole('button', { name: new RegExp(personal) });
  for (let i = 0; i < 2 && !(await projected.isVisible()); i++) {
    await page.getByRole('button', { name: 'Semana siguiente' }).click();
  }
  await expect(projected).toContainText('Repetición prevista');

  // Pulsar una tarea abre el formulario para editarla
  await page.getByRole('button', { name: 'Hoy' }).click();
  await page.getByRole('button', { name: 'Por días' }).click();
  await tomorrow.getByRole('button', { name: new RegExp(work) }).click();
  await expect(page.getByRole('heading', { name: 'Editar Acción Operativa' })).toBeVisible();
});
