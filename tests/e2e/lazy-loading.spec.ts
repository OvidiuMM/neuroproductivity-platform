import { expect, test } from '@playwright/test';
import { openSection, signInWithGoogle } from './helpers';

// Las secciones y ventanas que no se ven al arrancar se descargan al abrirlas; si la descarga falla (p. ej. sin
// conexión) la app sigue en pie y se puede reintentar. En desarrollo cada componente es su propio módulo.
// El navegador recuerda una descarga fallida, así que «Reintentar» recarga la página si el servidor responde.
test('if a section cannot be downloaded, the app stays usable and it can be retried', async ({ page }) => {
  test.slow(); // Recarga la página entera
  await page.goto('/');
  await signInWithGoogle(page);
  await page.route('**/src/components/AgendaView.tsx*', (route) => route.abort());

  await openSection(page, 'Agenda');
  await expect(page.getByRole('alert')).toContainText('No se pudo cargar esta sección');
  // La navegación sigue funcionando
  await openSection(page, 'Listas');
  await expect(page.getByRole('button', { name: 'Añadir la primera tarea' })).toBeVisible();

  // Sin conexión, «Reintentar» no recarga: sigue el aviso
  await openSection(page, 'Agenda');
  await page.route('**/manifest.json', (route) => route.abort());
  const probed = page.waitForEvent('requestfailed', (request) => request.url().includes('/manifest.json'));
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await probed;
  await expect(page.getByRole('alert')).toContainText('No se pudo cargar esta sección');

  // Con conexión otra vez, «Reintentar» recarga la página y la sección se abre
  await page.unroute('**/manifest.json');
  await page.unroute('**/src/components/AgendaView.tsx*');
  const reloaded = page.waitForEvent('load');
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await reloaded;
  await openSection(page, 'Agenda');
  await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();
});

test('a dialog that is still downloading can be cancelled, and one that failed can be retried', async ({ page }) => {
  test.slow(); // Recarga la página entera
  await page.goto('/');
  await signInWithGoogle(page);
  await openSection(page, 'Metas');

  // Descarga lenta: se ve una ventana provisional que se puede cancelar
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/src/components/GoalModal.tsx*', async (route) => {
    await held;
    await route.continue();
  });
  await page.getByRole('button', { name: 'Nueva meta', exact: true }).click();
  const pending = page.getByRole('dialog', { name: 'Cargando…' });
  await expect(pending).toBeVisible();
  await expect(pending.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await pending.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Cuando termina la descarga no se abre sola; la próxima vez se abre al momento
  release();
  await page.getByRole('button', { name: 'Nueva meta', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Nueva meta' })).toBeVisible();
  await page.keyboard.press('Escape');

  // Descarga fallida en otra ventana (el recorrido, que solo se abre a mano): aviso con «Reintentar», que recarga la
  // página
  await page.route('**/src/components/ProductTour.tsx*', (route) => route.abort());
  await openSection(page, 'Ayuda');
  await page.getByRole('button', { name: 'Repetir el recorrido' }).click();
  const failed = page.getByRole('dialog', { name: 'No se pudo abrir. Comprueba la conexión.' });
  await expect(failed).toBeVisible();
  await expect(failed.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await page.unroute('**/src/components/ProductTour.tsx*');
  const reloaded = page.waitForEvent('load');
  await failed.getByRole('button', { name: 'Reintentar' }).click();
  await reloaded;
  await openSection(page, 'Ayuda');
  await page.getByRole('button', { name: 'Repetir el recorrido' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog', { name: /Cargando|No se pudo abrir/ })).toHaveCount(0);
});
