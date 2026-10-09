import { test } from '@playwright/test';
import { expectNoHorizontalOverflow, signInWithGoogle } from './helpers';

// Nombres de las pestañas: en móvil (< 768 px) se usa la barra inferior de la cabecera
const TABS = {
  mobile: ['Listas', 'Rueda', 'Bermudas', 'Requisitos', 'Ayuda'],
  desktop: ['Listas Duales', 'Rueda de la Vida', 'Blindaje Bermudas', 'Requisitos', 'Cómo funciona']
};

for (const width of [360, 375, 768, 1280]) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expectNoHorizontalOverflow(page, 'login');

    await signInWithGoogle(page);
    for (const name of width < 768 ? TABS.mobile : TABS.desktop) {
      await page.getByRole('button', { name, exact: true }).click();
      await page.waitForTimeout(300);
      await expectNoHorizontalOverflow(page, `pestaña ${name}`);
    }
  });
}
