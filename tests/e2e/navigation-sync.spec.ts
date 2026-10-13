import { expect, test } from '@playwright/test';
import { fillAndSaveTask, signInWithGoogle } from './helpers';

test('phones use a bottom section bar, a «Más» sheet and a floating «Nueva tarea» button', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  await signInWithGoogle(page);

  // La cabecera solo lleva la marca, las listas y la sincronización
  const header = page.locator('header');
  await expect(header.getByRole('navigation')).toBeHidden();
  await expect(header.getByRole('button', { name: 'Tu cuenta' })).toBeHidden();
  await expect(header.locator('[data-sync-status]')).toBeVisible();

  // Barra inferior: cuatro secciones y «Más», con su nombre corto a la vista
  const bar = page.getByRole('navigation', { name: 'Secciones' });
  await expect(bar.getByRole('button')).toHaveText(['Inicio', 'Listas', 'Agenda', 'Rueda', 'Más']);
  await bar.getByRole('button', { name: 'Agenda' }).click();
  await expect(bar.getByRole('button', { name: 'Agenda' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();

  // Las zonas táctiles miden al menos 44 px
  for (const button of await bar.getByRole('button').all()) {
    const box = (await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }

  // «Más»: el resto de secciones, la sincronización y la cuenta
  const more = bar.getByRole('button', { name: 'Más secciones' });
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.click();
  const sheet = page.getByRole('dialog', { name: 'Más' });
  await expect(sheet.getByRole('navigation').getByRole('button')).toHaveText(['Blindaje Bermudas', 'Cómo funciona']);
  await expect(
    sheet.locator('[aria-label^="Sincronizado"], [aria-label^="Hay cambios"], [aria-label^="Sin conexión"]')
  ).toHaveCount(1);
  await expect(sheet.getByRole('button', { name: 'Tu cuenta' })).toBeVisible();

  await sheet.getByRole('button', { name: 'Blindaje Bermudas' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole('heading', { name: /Blindaje/ }).first()).toBeVisible();

  // Escape cierra la hoja, que marca la sección activa, y el foco vuelve a «Más»
  await more.click();
  await expect(sheet.getByRole('button', { name: 'Blindaje Bermudas' })).toHaveAttribute('aria-current', 'page');
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(more).toBeFocused();

  // Tocar fuera de la hoja también la cierra
  await more.click();
  await page.mouse.click(180, 60);
  await expect(sheet).toBeHidden();

  // «Tu cuenta» abre la cuenta desde la hoja
  await more.click();
  await sheet.getByRole('button', { name: 'Tu cuenta' }).click();
  await expect(page.getByRole('dialog', { name: 'Tu cuenta' })).toBeVisible();
  await page.keyboard.press('Escape');

  // «Nueva tarea» flota sobre la barra y abre el formulario
  const newTask = page.getByRole('button', { name: 'Nueva tarea', exact: true });
  const newTaskBox = (await newTask.boundingBox())!;
  const barBox = (await bar.boundingBox())!;
  expect(newTaskBox.y + newTaskBox.height).toBeLessThanOrEqual(barBox.y);
  await newTask.click();
  await expect(page.getByRole('dialog', { name: /Nueva Acción|Capturar/ })).toBeVisible();
});

test('the requirements view no longer exists', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);

  await expect(page.getByRole('button', { name: /Requisitos/ })).toHaveCount(0);
});

test('sync indicator turns orange without connection and green after forcing a sync', async ({ page, context }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  const indicator = page.locator('header [data-sync-status]');
  await expect(indicator).toHaveAttribute('data-sync-status', 'synced', { timeout: 15_000 });

  await context.setOffline(true);
  await expect(indicator).toHaveAttribute('data-sync-status', 'offline');

  // Sin conexión, forzar la sincronización no da por bueno nada aunque no haya cambios pendientes
  await indicator.click();
  await expect(page.getByText(/^No se pudo sincronizar/)).toBeVisible({ timeout: 20_000 });

  // Sin conexión la tarea se guarda en el dispositivo y se ve al instante
  const title = `Llamar al fontanero ${Date.now().toString(36)}`;
  await page.getByRole('button', { name: 'Listas Duales' }).click();
  await page.getByRole('button', { name: 'Capturar Primera Acción' }).click();
  await fillAndSaveTask(page, { title });
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(indicator).not.toHaveAttribute('data-sync-status', 'synced');

  await context.setOffline(false);
  await indicator.click();
  await expect(indicator).toHaveAttribute('data-sync-status', 'synced', { timeout: 20_000 });

  // Tras recargar, la tarea viene del servidor
  await page.reload();
  await page.getByRole('button', { name: 'Listas Duales' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
});
