import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, expectNoInnerOverflow, signInWithGoogle } from './helpers';

// En escritorio las secciones son pestañas; en el móvil (< 768 px) están en el menú de la cabecera
const SECTIONS = ['Inicio', 'Listas Duales', 'Agenda', 'Rueda de la Vida', 'Blindaje Bermudas', 'Cómo funciona'];

for (const width of [360, 375, 768, 1280]) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expectNoHorizontalOverflow(page, 'login');

    await signInWithGoogle(page);

    // La cabecera ocupa una sola línea y «Nueva tarea» queda debajo de ella
    const header = (await page.locator('header').boundingBox())!;
    expect(header.height, 'altura de la cabecera').toBeLessThanOrEqual(72);
    const newTask = (await page.getByRole('button', { name: 'Nueva tarea', exact: true }).boundingBox())!;
    expect(newTask.y).toBeGreaterThanOrEqual(header.y + header.height);

    for (const name of SECTIONS) {
      if (width < 768) await page.getByRole('button', { name: 'Menú' }).click();
      await page.getByRole('button', { name, exact: true }).click();
      await page.waitForTimeout(300);
      await expectNoHorizontalOverflow(page, `sección ${name}`);
      // Tampoco se sale nada de su caja (p. ej. las cifras de las tarjetas de indicadores)
      await expectNoInnerOverflow(page, `contenido de la sección ${name}`);
    }

    // En escritorio, el nombre y la versión no pueden quedar debajo de la primera pestaña
    if (width >= 1280) {
      const version = await page
        .locator('header')
        .getByText(/^v\d+\.\d+\.\d+$/)
        .boundingBox();
      const firstTab = await page.getByRole('button', { name: SECTIONS[0], exact: true }).boundingBox();
      expect(version!.x + version!.width).toBeLessThanOrEqual(firstTab!.x);
    }
  });
}
