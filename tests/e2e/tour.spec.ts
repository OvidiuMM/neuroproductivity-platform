import { expect, test, type Page } from '@playwright/test';
import { openSection, signInWithGoogle } from './helpers';

// El hueco del recorrido rodea el elemento resaltado (con 6 px de margen)
const expectSpotlightOn = async (page: Page, target: ReturnType<Page['locator']>) => {
  await expect
    .poll(async () => {
      const hole = await page.locator('[data-tour-hole]').boundingBox();
      const box = await target.boundingBox();
      return hole && box ? Math.round(Math.abs(hole.x + 6 - box.x) + Math.abs(hole.y + 6 - box.y)) : -1;
    })
    .toBeLessThanOrEqual(2);
};

const startFromHelp = async (page: Page) => {
  await openSection(page, 'Cómo funciona');
  await page.getByRole('button', { name: 'Repetir el recorrido' }).click();
};

test('the guided tour walks through the essentials with the keyboard and can be repeated from the guide', async ({
  page
}) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await startFromHelp(page);

  const step = (title: string) => page.getByRole('dialog', { name: title });
  await expect(step('Captura una tarea')).toContainText('Paso 1 de 8');
  await expect(page.getByRole('heading', { name: 'Captura una tarea' })).toBeFocused();
  await expectSpotlightOn(page, page.getByRole('button', { name: 'Nueva tarea', exact: true }));

  // Flechas para avanzar y volver
  await page.keyboard.press('ArrowRight');
  await expect(step('Dos listas que no se mezclan')).toBeVisible();
  await expectSpotlightOn(page, page.getByRole('group', { name: 'Lista activa' }));
  await page.keyboard.press('ArrowLeft');
  await expect(step('Captura una tarea')).toBeVisible();

  // Con «Siguiente» hasta el final; empieza en las listas, donde están el Top 10 y los filtros
  for (const title of ['Dos listas que no se mezclan', 'Tu Top 10', 'Ordena y filtra', 'Agenda', 'Rueda y metas']) {
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(step(title)).toBeVisible();
  }
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(step('Tu progreso')).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(step('Ayuda')).toContainText('Paso 8 de 8');
  await page.getByRole('button', { name: 'Terminar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Mientras dura, el resto de la página no responde; al terminar, sí
  await page.getByRole('button', { name: 'Nueva tarea', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Captura de Nueva Acción Inmediata' })).toBeVisible();
});

test('on a phone the tour points at the floating button and at «Más»', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  await signInWithGoogle(page);
  await startFromHelp(page);

  await expect(page.getByRole('dialog', { name: 'Captura una tarea' })).toBeVisible();
  await expectSpotlightOn(page, page.getByRole('button', { name: 'Nueva tarea', exact: true }));
  for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog', { name: 'Ayuda' })).toBeVisible();
  await expectSpotlightOn(page, page.getByRole('button', { name: 'Más secciones' }));

  // El globo queda dentro de la pantalla
  const bubble = (await page.getByRole('dialog', { name: 'Ayuda' }).boundingBox())!;
  expect(bubble.x).toBeGreaterThanOrEqual(0);
  expect(bubble.x + bubble.width).toBeLessThanOrEqual(375);
  expect(bubble.y + bubble.height).toBeLessThanOrEqual(800);

  await page.getByRole('button', { name: 'Salir del recorrido' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
