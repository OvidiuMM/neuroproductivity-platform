import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ADMIN_EMAIL, fillAndSaveTask, localDateFromToday, signInWithGoogle, uniqueEmail } from './helpers';

// Esperas que pasan por una Cloud Function del emulador: con la suite en paralelo su arranque puede tardar
const SERVER_CALL = { timeout: 15_000 };

// Auditoría automática WCAG 2.1 A y AA con axe-core en cada pantalla. Sin animaciones, para que axe no mida
// colores a mitad de una transición.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
test.use({ reducedMotion: 'reduce' });

const SPLASH = '[role="status"][aria-label="Cargando CLAR"]';

// `include` limita la auditoría a una parte de la página (p. ej. la pantalla de bienvenida, que dura poco)
const expectNoViolations = async (page: Page, screen: string, include?: string) => {
  // Salvo que se audite ella misma, se espera a que la pantalla de bienvenida se quite y se audita lo de debajo
  if (include !== SPLASH) await expect(page.locator(SPLASH)).toHaveCount(0);
  const builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
  const { violations } = await (include ? builder.include(include) : builder).analyze();
  const summary = violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes
        .slice(0, 4)
        .map((n) => n.target.join(' '))
        .join('\n    ')}`
  );
  expect.soft(summary, `${screen}\n${summary.join('\n')}`).toEqual([]);
};

test('login and access request screens', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeVisible();
  await expectNoViolations(page, 'inicio de sesión');

  await signInWithGoogle(page, undefined, undefined, { approve: false });
  await expect(page.getByRole('heading', { name: 'Solicita acceso' })).toBeVisible(SERVER_CALL);
  await expectNoViolations(page, 'solicitud de acceso');
});

test('main sections, forms and dialogs', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  // Primer arranque: Rueda de la Vida
  await expectNoViolations(page, 'rueda de la vida (primer arranque)');

  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Foco de Concentración Profesional' })).toBeVisible();
  await expectNoViolations(page, 'inicio');

  await page.getByRole('button', { name: 'Listas Duales' }).click();
  await page.getByRole('button', { name: 'Capturar Primera Acción' }).click();
  await expect(page.getByRole('heading', { name: 'Captura de Nueva Acción Inmediata' })).toBeVisible();
  await expectNoViolations(page, 'formulario de tarea');

  await page.getByRole('button', { name: 'Calendario: Fecha límite' }).click();
  await expectNoViolations(page, 'calendario');
  await page.keyboard.press('Escape');

  await fillAndSaveTask(page, {
    title: 'Llamar al cliente para revisar la propuesta',
    dueDate: localDateFromToday(1),
    dueTime: '10:00'
  });
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
  await page.getByRole('button', { name: 'Cerrar sesión en todos los dispositivos' }).click();
  await page.getByRole('button', { name: 'Eliminar mi cuenta y todos mis datos' }).click();
  await expectNoViolations(page, 'menú de la cuenta con la seguridad y la eliminación abiertas');

  await page.getByRole('button', { name: /^Accesibilidad/ }).click();
  await expect(page.getByRole('dialog', { name: 'Accesibilidad' })).toBeVisible();
  await expectNoViolations(page, 'panel de accesibilidad');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Listas Duales', exact: true }).click();
  await page.getByRole('button', { name: /Archivadas/ }).click();
  await expect(page.getByRole('dialog', { name: 'Tareas archivadas' })).toBeVisible();
  await expectNoViolations(page, 'tareas archivadas');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Blindaje Bermudas' }).click();
  await page.getByRole('button', { name: 'Agendar Reunión Blindada' }).click();
  await expect(page.getByRole('dialog', { name: /Blindaje de Reunión/ })).toBeVisible();
  await expectNoViolations(page, 'formulario de reunión');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Redactar Inversamente' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoViolations(page, 'formulario de correo');
  await page.keyboard.press('Escape');

  // Pantalla de bienvenida: se abre desde el pie y dura poco, así que se audita solo ella
  await page.getByRole('button', { name: /Ver Pantalla de Inicio Móvil/ }).click();
  await expectNoViolations(page, 'pantalla de bienvenida', SPLASH);
});

test('import dialog for data saved by the version without accounts', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const created = '2026-10-01T09:00:00.000Z';
    localStorage.setItem(
      'neuro_users_v1',
      JSON.stringify([
        {
          id: 'user-ana',
          name: 'Ana',
          role: '',
          color: 'indigo',
          initials: 'A',
          authProvider: 'local',
          createdAt: created
        }
      ])
    );
    localStorage.setItem(
      'neuro_tasks_v1',
      JSON.stringify([
        {
          id: 'task-local-1',
          userId: 'user-ana',
          listContext: 'WORK',
          title: 'Llamar al taller para pedir presupuesto',
          description: '',
          priority: 'HIGH',
          createdAt: created,
          updatedAt: created,
          observations: [],
          isSomeday: false,
          completed: false
        }
      ])
    );
  });
  await signInWithGoogle(page);
  await expect(page.getByRole('dialog', { name: 'Importar datos de este navegador' })).toBeVisible();
  await expectNoViolations(page, 'importar datos de este navegador');
});

test('high contrast and very large text', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'neuro_a11y_v1',
      JSON.stringify({ textSize: 'xlarge', highContrast: true, reduceMotion: true, strongFocus: true })
    )
  );
  await page.goto('/');
  await expectNoViolations(page, 'inicio de sesión (alto contraste)');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Listas Duales' }).click();
  await expectNoViolations(page, 'listas duales (alto contraste)');
  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  await expectNoViolations(page, 'agenda (alto contraste)');
});

test('phone section bar, «Más» sheet and floating new task button', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  await signInWithGoogle(page, ADMIN_EMAIL);
  await expectNoViolations(page, 'inicio en el móvil');
  await page.getByRole('button', { name: /^Más secciones/ }).click();
  await expect(page.getByRole('dialog', { name: 'Más' })).toBeVisible();
  await expectNoViolations(page, 'hoja «Más» (administración)');
});

test('goals: dialog, panel in the Wheel and card in Inicio', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Rueda de la Vida' }).click();
  await page.getByRole('button', { name: 'Nueva meta' }).click();
  await expectNoViolations(page, 'nueva meta');
  const editor = page.getByRole('dialog', { name: 'Nueva meta' });
  await editor.getByLabel('Meta').fill('Ahorrar para la entrada del piso');
  await editor.getByLabel('Área de la Rueda').selectOption('Finanzas');
  await editor.getByRole('button', { name: 'Crear la meta' }).click();
  await expect(page.getByRole('list', { name: 'Metas activas' })).toBeVisible();
  await expectNoViolations(page, 'rueda con metas');
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await expectNoViolations(page, 'inicio con metas');
});

test('email sign-up and email confirmation screens', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Crear una cuenta' }).click();
  await expectNoViolations(page, 'crear una cuenta');
  await page.getByRole('button', { name: 'Ya tengo cuenta: entrar' }).click();
  await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click();
  await expectNoViolations(page, 'recuperar la contraseña');
  await page.getByRole('button', { name: 'Volver a entrar' }).click();
  await page.getByRole('button', { name: 'Crear una cuenta' }).click();
  await page.getByLabel('Email', { exact: true }).fill(uniqueEmail());
  await page.getByLabel('Contraseña', { exact: true }).fill('clave-segura-1');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Confirma tu email' })).toBeVisible();
  await expectNoViolations(page, 'confirmar el email');
});

test('admin access tab', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page, ADMIN_EMAIL, 'Administración', { approve: false });
  await page.getByRole('button', { name: /^Accesos/ }).click();
  await expect(page.getByRole('heading', { name: 'Accesos' })).toBeVisible();
  await expectNoViolations(page, 'accesos');
});
