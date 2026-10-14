import { expect, test, type Page } from '@playwright/test';
import { fillAndSaveTask, localDateFromToday, openSection, signInWithGoogle } from './helpers';

const unique = () => Date.now().toString(36);

// Títulos de las tareas del Top 10, en el orden en que se muestran
const top10Titles = (page: Page) => page.locator('h4').allInnerTexts();

test('shows the physical-verb hint above the action field', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Nueva Tarea' }).click();

  await expect(page.getByText('Verbo físico:', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Acción Inmediata Siguiente')).toHaveAttribute('aria-describedby', 'task-title-hint');
});

test('ranks the Top 10 by effective priority and filters it by estimate and deadline', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Listas Duales' }).click();

  const far = `Llamar al arquitecto ${unique()}`; // Alta, pero vence en 30 días → cuenta como Media
  const quick = `Enviar la factura ${unique()}`; // Media, 15 min, vence en 2 días
  const long = `Reservar el viaje ${unique()}`; // Alta, 2 h, sin fecha

  await page.getByRole('button', { name: 'Capturar Primera Acción' }).click();
  await fillAndSaveTask(page, { title: far, priority: 'HIGH', dueDate: localDateFromToday(30), estimateMinutes: 60 });
  await page.getByRole('button', { name: 'Añadir tarea', exact: true }).click();
  await fillAndSaveTask(page, {
    title: quick,
    priority: 'MEDIUM',
    dueDate: localDateFromToday(2),
    estimateMinutes: 15
  });
  await page.getByRole('button', { name: 'Añadir tarea', exact: true }).click();
  await fillAndSaveTask(page, { title: long, priority: 'HIGH', estimateMinutes: 120 });

  // La tarea lejana muestra la prioridad rebajada y por qué
  const farRow = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: far }) });
  await expect(farRow.getByText('MEDIA', { exact: true })).toBeVisible();
  await expect(farRow.getByText('plazo > 1 semana')).toBeVisible();

  // Completar y «⋯» son grandes, fáciles de pulsar (al menos 44 px)
  for (const name of [`Marcar «${far}» como hecha`, `Acciones de «${far}»`]) {
    const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
    expect(Math.min(box.width, box.height), name).toBeGreaterThanOrEqual(44);
  }

  // Orden por prioridad efectiva: Alta (sin fecha) → Media que vence antes → Media lejana
  await expect.poll(() => top10Titles(page)).toEqual([long, quick, far]);

  await page.getByLabel('Ordenar por:').selectOption('estimate');
  await expect.poll(() => top10Titles(page)).toEqual([quick, far, long]);

  await page.getByRole('button', { name: 'Filtros' }).click();
  await page.getByLabel('Estimación hasta').selectOption('30');
  await expect.poll(() => top10Titles(page)).toEqual([quick]);
  await expect(page.getByText('2 tareas ocultas por los filtros.')).toBeVisible();
  // El resumen «Top 10 Foco» de Inicio cuenta lo mismo que muestra la lista
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await expect(page.getByText('1/10', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Listas Duales', exact: true }).click();

  // Si los filtros lo ocultan todo, no se invita a crear la primera tarea
  await page.getByLabel('Fecha límite', { exact: true }).selectOption('OVERDUE');
  await expect(page.getByText('Ninguna tarea coincide con los filtros (3 ocultas).')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Capturar Primera Acción' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await expect(page.getByText('0/10', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Listas Duales', exact: true }).click();
  await page.getByRole('button', { name: 'Mostrar todas las tareas' }).click();
  await expect.poll(() => top10Titles(page)).toEqual([quick, far, long]);

  await page.getByLabel('Fecha límite', { exact: true }).selectOption('NO_DATE');
  await expect.poll(() => top10Titles(page)).toEqual([long]);

  // Las preferencias se guardan: tras recargar siguen el orden y el filtro
  await page.reload();
  await page.getByRole('button', { name: 'Listas Duales' }).click();
  await expect(page.getByLabel('Ordenar por:')).toHaveValue('estimate');
  await expect.poll(() => top10Titles(page)).toEqual([long]);

  await page.getByRole('button', { name: 'Quitar filtros' }).click();
  await expect.poll(() => top10Titles(page)).toEqual([quick, far, long]);
});

test('on a phone, sort and filters open in a sheet and active filters are removable chips', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  await signInWithGoogle(page);
  await openSection(page, 'Listas Duales');

  const short = `Enviar el recibo ${unique()}`;
  const long = `Preparar la reunión ${unique()}`;
  await page.getByRole('button', { name: 'Capturar Primera Acción' }).click();
  await fillAndSaveTask(page, { title: short, estimateMinutes: 15 });
  await page.getByRole('button', { name: 'Añadir tarea', exact: true }).click();
  await fillAndSaveTask(page, { title: long, estimateMinutes: 120 });

  const open = page.getByRole('button', { name: 'Ordenar y filtrar' });
  await open.click();
  const sheet = page.getByRole('dialog', { name: 'Ordenar y filtrar' });
  await sheet.getByLabel('Ordenar por:').selectOption('estimate');
  await sheet.getByLabel('Estimación hasta').selectOption('30');
  await sheet.getByRole('button', { name: 'Ver 1 tarea' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole('button', { name: 'Ordenar y filtrar (1)' })).toBeFocused();
  await expect.poll(() => top10Titles(page)).toEqual([short]);

  // El filtro activo queda a la vista y se quita con un toque
  const chip = page.getByRole('button', { name: 'Quitar el filtro Estimación hasta: 30 min' });
  await chip.click();
  await expect(chip).toBeHidden();
  await expect.poll(() => top10Titles(page)).toEqual([short, long]);
});
