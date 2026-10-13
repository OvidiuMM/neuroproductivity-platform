import { expect, test, type Page } from '@playwright/test';
import { fillAndSaveTask, localDateFromToday, signInWithGoogle } from './helpers';

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
  await fillAndSaveTask(page, { title: quick, priority: 'MEDIUM', dueDate: localDateFromToday(2), estimateMinutes: 15 });
  await page.getByRole('button', { name: 'Añadir tarea', exact: true }).click();
  await fillAndSaveTask(page, { title: long, priority: 'HIGH', estimateMinutes: 120 });

  // La tarea lejana muestra la prioridad rebajada y por qué
  const farRow = page.locator('div.rounded-2xl', { has: page.getByRole('heading', { name: far }) }).last();
  await expect(farRow.getByText('MEDIA', { exact: true })).toBeVisible();
  await expect(farRow.getByText('plazo > 1 semana')).toBeVisible();

  // Los botones de cada tarea son grandes, fáciles de pulsar
  for (const name of [`Editar «${far}»`, `Eliminar «${far}»`, `Añadir «${far}» al calendario`]) {
    const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
    expect(Math.min(box.width, box.height), name).toBeGreaterThanOrEqual(40);
  }

  // Orden por prioridad efectiva: Alta (sin fecha) → Media que vence antes → Media lejana
  await expect.poll(() => top10Titles(page)).toEqual([long, quick, far]);

  await page.getByLabel('Ordenar por:').selectOption('estimate');
  await expect.poll(() => top10Titles(page)).toEqual([quick, far, long]);

  await page.getByRole('button', { name: 'Filtros' }).click();
  await page.getByLabel('Estimación hasta').selectOption('30');
  await expect.poll(() => top10Titles(page)).toEqual([quick]);
  await expect(page.getByText('2 tareas ocultas por los filtros.')).toBeVisible();
  // El resumen «Top 10 Foco» cuenta lo mismo que muestra la lista
  await expect(page.getByText('1/10', { exact: true })).toBeVisible();

  // Si los filtros lo ocultan todo, no se invita a crear la primera tarea
  await page.getByLabel('Fecha límite', { exact: true }).selectOption('OVERDUE');
  await expect(page.getByText('Ninguna tarea coincide con los filtros (3 ocultas).')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Capturar Primera Acción' })).toHaveCount(0);
  await expect(page.getByText('0/10', { exact: true })).toBeVisible();
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
