import { expect, test } from '@playwright/test';
import { signInWithGoogle } from './helpers';

const fullDay = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const longDay = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const pad = (n: number) => String(n).padStart(2, '0');
const fromToday = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

test('date fields use a Monday-first calendar and dd/mm/aaaa, with keyboard support', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Listas Duales' }).click();
  await page.getByRole('button', { name: 'Capturar Primera Acción' }).click();

  const dueDate = page.getByLabel('Fecha límite', { exact: true });
  const openCalendar = page.getByRole('button', { name: 'Calendario: Fecha límite' });
  const calendar = page.getByRole('dialog', { name: /Fecha límite/ });

  // La semana empieza en lunes: cabeceras L…D y el día 1 en su columna
  await openCalendar.click();
  await expect(calendar).toBeVisible();
  await expect(calendar.getByRole('columnheader')).toHaveText(['L', 'M', 'X', 'J', 'V', 'S', 'D']);
  await expect(calendar.getByRole('columnheader').first().locator('abbr')).toHaveAttribute('title', 'lunes');
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const firstWeek = calendar.getByRole('row').nth(1).getByRole('gridcell');
  await expect(firstWeek.nth((firstOfMonth.getDay() + 6) % 7).getByRole('button')).toHaveAccessibleName(
    fullDay.format(firstOfMonth)
  );

  // Sin fecha, el foco empieza en hoy; Inicio y Fin van al lunes y al domingo de la semana
  await expect(calendar.getByRole('button', { name: fullDay.format(today) })).toBeFocused();
  const monday = fromToday(-((today.getDay() + 6) % 7));
  const sunday = fromToday(6 - ((today.getDay() + 6) % 7));
  await page.keyboard.press('Home');
  await expect(calendar.getByRole('button', { name: fullDay.format(monday) })).toBeFocused();
  await page.keyboard.press('End');
  await expect(calendar.getByRole('button', { name: fullDay.format(sunday) })).toBeFocused();

  // Escape cierra el calendario sin cerrar el formulario y devuelve el foco al botón
  await page.keyboard.press('Escape');
  await expect(calendar).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Captura de Nueva Acción Inmediata' })).toBeVisible();
  await expect(openCalendar).toBeFocused();

  // Escrita a mano se normaliza a dd/mm/aaaa; una fecha imposible bloquea el guardado
  await dueDate.fill('5/3/2027');
  await dueDate.blur();
  await expect(dueDate).toHaveValue('05/03/2027');
  const title = `Revisar el contrato ${Date.now().toString(36)}`;
  await page.getByPlaceholder('ej. Llamar al proveedor para acordar el plazo de entrega').fill(title);
  await page
    .getByPlaceholder('Detalla el resultado esperado, personas involucradas o requerimientos físicos previos...')
    .fill('Confirmar las cláusulas de entrega.');
  await dueDate.fill('31/02/2027');
  await expect(dueDate).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: 'Guardar Acción Operativa' }).click();
  await expect(page.getByRole('heading', { name: 'Captura de Nueva Acción Inmediata' })).toBeVisible();
  expect(await dueDate.evaluate((el: HTMLInputElement) => el.validationMessage)).toBe(
    'Escribe la fecha como dd/mm/aaaa'
  );

  // Con el teclado: mañana con flecha derecha + Intro
  await dueDate.fill('');
  await openCalendar.click();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(calendar).toBeHidden();
  const tomorrow = fromToday(1);
  await expect(dueDate).toHaveValue(
    `${pad(tomorrow.getDate())}/${pad(tomorrow.getMonth() + 1)}/${tomorrow.getFullYear()}`
  );

  await page.getByRole('button', { name: 'Guardar Acción Operativa' }).click();
  await expect(page.getByRole('button', { name: 'Guardar Acción Operativa' })).toBeHidden();

  // La agenda también empieza la semana en lunes y muestra la tarea en el día elegido
  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Semana' }).getByRole('listitem').first()).toHaveAccessibleName(/^lunes/);
  await page.getByRole('button', { name: 'Por días' }).click();
  await expect(
    page
      .getByRole('region', { name: new RegExp(longDay.format(tomorrow), 'i') })
      .getByRole('button', { name: new RegExp(title) })
  ).toBeVisible();
});

test('the calendar stays inside the screen on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Menú' }).click();
  await page.getByRole('button', { name: 'Listas Duales' }).click();
  await page.getByRole('button', { name: 'Capturar Primera Acción' }).click();
  await page.getByLabel('Repetir').selectOption('MONTHLY');

  for (const name of ['Calendario: Fecha límite', 'Calendario: Fecha de inicio']) {
    await page.getByRole('button', { name }).click();
    const box = await page.getByRole('dialog', { name: /Fecha límite|Fecha de inicio/ }).boundingBox();
    expect(box, name).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);
    expect(box!.y + box!.height).toBeLessThanOrEqual(740);
    await page.keyboard.press('Escape');
  }
});

test('a meeting needs a date: clearing it disables saving and says why', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Blindaje Bermudas' }).click();
  await page.getByRole('button', { name: 'Agendar Reunión Blindada' }).click();
  await page.getByRole('button', { name: 'Calendario: Fecha de la reunión' }).click();
  await page
    .getByRole('dialog', { name: /Fecha de la reunión/ })
    .getByRole('button', { name: 'Borrar' })
    .click();
  await expect(page.getByLabel('Fecha', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('alert').filter({ hasText: 'La reunión necesita una fecha.' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Guardar Convocatoria Blindada/ })).toBeDisabled();
});
