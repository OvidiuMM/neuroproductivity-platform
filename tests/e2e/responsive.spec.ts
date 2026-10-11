import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, signInWithGoogle } from './helpers';

// En escritorio las secciones son pestañas; en el móvil (< 768 px) están en el menú de la cabecera
const SECTIONS = ['Listas Duales', 'Agenda', 'Rueda de la Vida', 'Blindaje Bermudas', 'Cómo funciona'];

for (const width of [360, 375, 768, 1280]) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expectNoHorizontalOverflow(page, 'login');

    await signInWithGoogle(page);
    for (const name of SECTIONS) {
      if (width < 768) await page.getByRole('button', { name: 'Menú' }).click();
      await page.getByRole('button', { name, exact: true }).click();
      await page.waitForTimeout(300);
      await expectNoHorizontalOverflow(page, `sección ${name}`);
    }

    // En escritorio, el nombre y la versión no pueden quedar debajo de la primera pestaña
    if (width >= 1280) {
      const version = await page.locator('header').getByText(/^v\d+\.\d+\.\d+$/).boundingBox();
      const firstTab = await page.getByRole('button', { name: SECTIONS[0], exact: true }).boundingBox();
      expect(version!.x + version!.width).toBeLessThanOrEqual(firstTab!.x);
    }
  });
}
