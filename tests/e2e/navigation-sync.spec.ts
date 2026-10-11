import { expect, test } from '@playwright/test';
import { fillAndSaveTask, signInWithGoogle } from './helpers';

test('phones use a sections menu in the header instead of a tab row', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  await signInWithGoogle(page);

  const menuButton = page.getByRole('button', { name: 'Menú' });
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  await menuButton.click();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true');

  const menu = page.locator('#mobile-sections-menu');
  await expect(menu.getByRole('button')).toHaveText(['Listas Duales', 'Rueda de la Vida', 'Blindaje Bermudas', 'Cómo funciona']);

  await menu.getByRole('button', { name: 'Blindaje Bermudas' }).click();
  await expect(menu).toBeHidden();
  await expect(page.getByRole('heading', { name: /Blindaje/ }).first()).toBeVisible();

  // Escape también cierra el menú y marca la sección activa
  await menuButton.click();
  await expect(menu.getByRole('button', { name: 'Blindaje Bermudas' })).toHaveAttribute('aria-current', 'page');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();

  // Pulsar otro control de la cabecera también lo cierra
  await menuButton.click();
  await expect(menu).toBeVisible();
  await page.getByRole('button', { name: 'Nueva Tarea' }).click();
  await expect(menu).toBeHidden();
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
