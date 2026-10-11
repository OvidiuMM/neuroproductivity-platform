import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ADMIN_EMAIL, fillAndSaveTask, localDateFromToday, signInWithGoogle } from './helpers';

// Auditoría automática WCAG 2.1 A y AA con axe-core en cada pantalla. Sin animaciones, para que axe no mida
// colores a mitad de una transición.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
test.use({ reducedMotion: 'reduce' });

const expectNoViolations = async (page: Page, screen: string) => {
  // La pantalla de bienvenida se desvanece sola; se audita lo que queda debajo
  await expect(page.getByRole('status', { name: 'Cargando NeuroProductividad' })).toHaveCount(0);
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const summary = violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.slice(0, 4).map((n) => n.target.join(' ')).join('\n    ')}`
  );
  expect.soft(summary, `${screen}\n${summary.join('\n')}`).toEqual([]);
};

test('login and access request screens', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeVisible();
  await expectNoViolations(page, 'inicio de sesión');

  await signInWithGoogle(page, undefined, undefined, { approve: false });
  await expect(page.getByRole('heading', { name: 'Solicita acceso' })).toBeVisible();
  await expectNoViolations(page, 'solicitud de acceso');
});

test('main sections, forms and dialogs', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  // Primer arranque: Rueda de la Vida
  await expectNoViolations(page, 'rueda de la vida (primer arranque)');

  await page.getByRole('button', { name: 'Listas Duales' }).click();
  await page.getByRole('button', { name: 'Capturar Primera Acción' }).click();
  await expect(page.getByRole('heading', { name: 'Captura de Nueva Acción Inmediata' })).toBeVisible();
  await expectNoViolations(page, 'formulario de tarea');

  await page.getByRole('button', { name: 'Calendario: Fecha límite' }).click();
  await expectNoViolations(page, 'calendario');
  await page.keyboard.press('Escape');

  await fillAndSaveTask(page, { title: 'Llamar al cliente para revisar la propuesta', dueDate: localDateFromToday(1), dueTime: '10:00' });
  await expectNoViolations(page, 'listas duales');

  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  await expectNoViolations(page, 'agenda (semana)');
  await page.getByRole('button', { name: 'Por días' }).click();
  await expectNoViolations(page, 'agenda (por días)');

  await page.getByRole('button', { name: 'Blindaje Bermudas' }).click();
  await expectNoViolations(page, 'blindaje bermudas');

  await page.getByRole('button', { name: 'Cómo funciona' }).click();
  await expectNoViolations(page, 'cómo funciona');

  await page.getByRole('button', { name: 'Tu cuenta' }).click();
  await expectNoViolations(page, 'menú de la cuenta');

  await page.getByRole('button', { name: /^Accesibilidad/ }).click();
  await expect(page.getByRole('dialog', { name: 'Accesibilidad' })).toBeVisible();
  await expectNoViolations(page, 'panel de accesibilidad');
});

test('high contrast and very large text', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('neuro_a11y_v1', JSON.stringify({ textSize: 'xlarge', highContrast: true, reduceMotion: true, strongFocus: true }))
  );
  await page.goto('/');
  await expectNoViolations(page, 'inicio de sesión (alto contraste)');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Listas Duales' }).click();
  await expectNoViolations(page, 'listas duales (alto contraste)');
  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  await expectNoViolations(page, 'agenda (alto contraste)');
});

test('admin access tab', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page, ADMIN_EMAIL, 'Administración', { approve: false });
  await page.getByRole('button', { name: /^Accesos/ }).click();
  await expect(page.getByRole('heading', { name: 'Accesos' })).toBeVisible();
  await expectNoViolations(page, 'accesos');
});
