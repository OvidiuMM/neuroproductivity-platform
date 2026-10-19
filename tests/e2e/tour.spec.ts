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
  await openSection(page, 'Ayuda');
  await page.getByRole('button', { name: 'Repetir el recorrido' }).click();
};

test('the guided tour walks through the essentials with the keyboard and can be repeated from the guide', async ({
  page
}) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await startFromHelp(page);

  const step = (title: string) => page.getByRole('dialog', { name: title });
  await expect(step('Captura una tarea')).toContainText('Paso 1 de 10');
  await expect(page.getByRole('heading', { name: 'Captura una tarea' })).toBeFocused();
  await expectSpotlightOn(page, page.getByRole('button', { name: 'Nueva tarea', exact: true }));

  // Flechas para avanzar y volver
  await page.keyboard.press('ArrowRight');
  await expect(step('Dos listas que no se mezclan')).toBeVisible();
  await expectSpotlightOn(page, page.getByRole('group', { name: 'Lista activa' }));
  await page.keyboard.press('ArrowLeft');
  await expect(step('Captura una tarea')).toBeVisible();

  // Con «Siguiente» hasta el final; empieza en las listas, donde están el Top 10 y los filtros
  for (const title of [
    'Dos listas que no se mezclan',
    'Tu Top 10',
    'Ordena y filtra',
    'Agenda',
    'Rueda de la Vida',
    'Metas',
    'Proyectos (opcional)'
  ]) {
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(step(title)).toBeVisible();
  }
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(step('Tu progreso')).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(step('Ayuda')).toContainText('Paso 10 de 10');
  await page.getByRole('button', { name: 'Terminar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Repetido desde la ayuda, no lleva a la Rueda (eso es solo la primera vez): sigue en las listas
  await expect(page.getByText('Primer paso: evalúa tu Rueda de la Vida')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Listas', exact: true })).toHaveAttribute('aria-current', 'page');

  // Mientras dura, el resto de la página no responde; al terminar, sí
  await page.getByRole('button', { name: 'Nueva tarea', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Nueva tarea' })).toBeVisible();
});

test('on a phone the tour points at the floating button and at «Más»', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  await signInWithGoogle(page);
  await startFromHelp(page);

  await expect(page.getByRole('dialog', { name: 'Captura una tarea' })).toBeVisible();
  await expectSpotlightOn(page, page.getByRole('button', { name: 'Nueva tarea', exact: true }));
  // La Rueda está en «Más»; Metas, en la barra
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog', { name: 'Rueda de la Vida' })).toBeVisible();
  await expectSpotlightOn(page, page.getByRole('button', { name: 'Más secciones' }));
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog', { name: 'Metas' })).toBeVisible();
  await expectSpotlightOn(
    page,
    page.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name: 'Metas' })
  );
  // Proyectos, opcionales, están en «Más»
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog', { name: 'Proyectos (opcional)' })).toBeVisible();
  await expectSpotlightOn(page, page.getByRole('button', { name: 'Más secciones' }));
  for (let i = 0; i < 2; i++) await page.keyboard.press('ArrowRight');
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

test('the bubble stays on screen when only the window height changes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await signInWithGoogle(page);
  await startFromHelp(page);
  const bubble = page.getByRole('dialog', { name: 'Captura una tarea' });
  await expect(bubble).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 320 });
  await expect
    .poll(async () => {
      const box = (await bubble.boundingBox())!;
      return box.y >= 0 && box.y + box.height <= 320;
    })
    .toBe(true);
});
