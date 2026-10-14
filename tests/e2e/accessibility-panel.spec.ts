import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalOverflow, openSection, signInWithGoogle } from './helpers';

const rootFontSize = (page: Page) => page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
const htmlClasses = (page: Page) => page.evaluate(() => [...document.documentElement.classList]);

test('the accessibility panel changes text size, contrast, motion and focus, and remembers them', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Tu cuenta' }).click();
  await page.getByRole('button', { name: /^Accesibilidad/ }).click();
  const panel = page.getByRole('dialog', { name: 'Accesibilidad' });
  await expect(panel).toBeVisible();

  expect(await rootFontSize(page)).toBe('16px');
  await panel.getByText('Muy grande').click();
  expect(await rootFontSize(page)).toBe('20px');

  // Un texto gris secundario se oscurece con el alto contraste
  const hint = panel.getByText('Se guarda en este dispositivo.');
  const before = await hint.evaluate((el) => getComputedStyle(el).color);
  await panel.getByRole('switch', { name: 'Alto contraste' }).click();
  await expect(panel.getByRole('switch', { name: 'Alto contraste' })).toHaveAttribute('aria-checked', 'true');
  expect(await hint.evaluate((el) => getComputedStyle(el).color)).not.toBe(before);

  await panel.getByRole('switch', { name: 'Reducir animaciones' }).click();
  await panel.getByRole('switch', { name: 'Foco muy visible' }).click();
  expect(await htmlClasses(page)).toEqual(
    expect.arrayContaining(['a11y-text-xlarge', 'a11y-contrast', 'a11y-reduce-motion', 'a11y-focus'])
  );

  // Escape cierra el panel; las preferencias siguen al recargar
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Tu cuenta' })).toBeVisible();
  expect(await rootFontSize(page)).toBe('20px');
  expect(await htmlClasses(page)).toEqual(
    expect.arrayContaining(['a11y-contrast', 'a11y-reduce-motion', 'a11y-focus'])
  );

  // Restablecer vuelve a los valores por defecto
  await page.getByRole('button', { name: 'Tu cuenta' }).click();
  await page.getByRole('button', { name: /^Accesibilidad/ }).click();
  await panel.getByRole('button', { name: 'Restablecer' }).click();
  expect(await rootFontSize(page)).toBe('16px');
  expect(await htmlClasses(page)).toEqual([]);
});

test('the panel is also available before signing in', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Accesibilidad' }).click();
  const panel = page.getByRole('dialog', { name: 'Accesibilidad' });
  await panel.getByText('Grande', { exact: true }).click();
  expect(await rootFontSize(page)).toBe('18px');
  await panel.getByRole('button', { name: 'Cerrar' }).click();
  await expect(panel).toBeHidden();
  await expect(page.getByRole('button', { name: 'Accesibilidad' })).toBeFocused();
});

test('dialogs take the focus and give it back when they close', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await expect(page.getByRole('status', { name: 'Cargando CLAR' })).toHaveCount(0);

  // El formulario de tarea recibe el foco (su primer control); Escape lo cierra y el foco vuelve al botón que lo abrió
  const newTask = page.getByRole('button', { name: 'Nueva Tarea' });
  await newTask.click();
  await expect(page.getByRole('dialog', { name: 'Nueva tarea' }).getByRole('button', { name: 'Cerrar' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Nueva tarea' })).toBeHidden();
  await expect(newTask).toBeFocused();

  // Del menú de la cuenta al panel de accesibilidad: al cerrar el panel, el foco vuelve al botón de la cuenta
  await page.getByRole('button', { name: 'Tu cuenta' }).click();
  await page.getByRole('button', { name: /^Accesibilidad/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Tu cuenta' })).toBeFocused();
});

test('with the panel open on the sign-in screen, the rest of the screen is inert', async ({ page }) => {
  await page.goto('/');
  const signIn = page.locator('button', { hasText: 'Continuar con Google' });
  expect(await signIn.evaluate((el) => Boolean(el.closest('[inert]')))).toBe(false);
  await page.getByRole('button', { name: 'Accesibilidad' }).click();
  expect(await signIn.evaluate((el) => Boolean(el.closest('[inert]')))).toBe(true);
  await page.keyboard.press('Escape');
  expect(await signIn.evaluate((el) => Boolean(el.closest('[inert]')))).toBe(false);
});

test('a skip link jumps to the main content', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await expect(page.getByRole('status', { name: 'Cargando CLAR' })).toHaveCount(0);
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Saltar al contenido' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
});

test('very large text does not overflow on phones, tablets or desktops', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('neuro_a11y_v1', JSON.stringify({ textSize: 'xlarge' })));
  await page.goto('/');
  await signInWithGoogle(page);
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const section of ['Listas', 'Agenda']) {
      await openSection(page, section);
      await expectNoHorizontalOverflow(page, `${section} a ${width}px con texto muy grande`);
    }
  }
});
