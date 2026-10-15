import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  ADMIN_EMAIL,
  callFunction,
  createVerifiedAccount,
  fillAndSaveTask,
  localDateFromToday,
  openSection,
  signInWithGoogle,
  uniqueEmail
} from './helpers';

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

test('legal pages', async ({ page }) => {
  for (const [path, title] of [
    ['/privacidad', 'Política de privacidad'],
    ['/condiciones', 'Condiciones de uso'],
    ['/aviso-legal', 'Aviso legal']
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expectNoViolations(page, title);
  }
});

test('main sections, forms and dialogs', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  // Primer arranque: Rueda de la Vida
  await expectNoViolations(page, 'rueda de la vida (primer arranque)');

  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu foco profesional' })).toBeVisible();
  await expectNoViolations(page, 'inicio');

  await page.getByRole('button', { name: 'Listas', exact: true }).click();
  await page.getByRole('button', { name: 'Añadir la primera tarea' }).click();
  await expect(page.getByRole('heading', { name: 'Nueva tarea' })).toBeVisible();
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

  await page.getByRole('button', { name: 'Tiempo protegido', exact: true }).click();
  await expectNoViolations(page, 'blindaje bermudas');

  await page.getByRole('button', { name: 'Ayuda', exact: true }).click();
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

  await page.getByRole('button', { name: 'Listas', exact: true }).click();
  await page.getByRole('button', { name: /Archivadas/ }).click();
  await expect(page.getByRole('dialog', { name: 'Tareas archivadas' })).toBeVisible();
  await expectNoViolations(page, 'tareas archivadas');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Tiempo protegido', exact: true }).click();
  await page.getByRole('button', { name: 'Planificar una reunión' }).click();
  await expect(page.getByRole('dialog', { name: 'Nueva reunión' })).toBeVisible();
  await expectNoViolations(page, 'formulario de reunión');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Escribir un correo' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoViolations(page, 'formulario de correo');
  await page.keyboard.press('Escape');

  // Pantalla de inicio: aparece al cargar la app y dura poco, así que se audita solo ella
  await page.reload();
  await expect(page.locator(SPLASH)).toBeVisible();
  await expectNoViolations(page, 'pantalla de inicio', SPLASH);
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
  await page.getByRole('button', { name: 'Listas', exact: true }).click();
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

test('goals: dialog, the Metas section and the card in Inicio', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await openSection(page, 'Rueda de la Vida');
  await page.getByRole('slider', { name: 'Puntuación de Familia' }).fill('3');
  await page.getByRole('button', { name: 'Guardar la evaluación' }).click();
  await page.getByRole('button', { name: 'Ir a Metas' }).click();
  await expect(page.getByRole('region', { name: 'Necesitan atención' })).toBeVisible();
  await expectNoViolations(page, 'metas con áreas que necesitan atención');
  await page.getByRole('button', { name: 'Nueva meta', exact: true }).click();
  await expectNoViolations(page, 'nueva meta');
  const editor = page.getByRole('dialog', { name: 'Nueva meta' });
  await editor.getByLabel('Meta').fill('Ahorrar para la entrada del piso');
  await editor.getByLabel('Área de la Rueda').selectOption('Finanzas');
  await editor.getByRole('button', { name: 'Crear la meta' }).click();
  await expect(page.getByRole('list', { name: 'Metas de Finanzas' })).toBeVisible();
  await expectNoViolations(page, 'metas con una meta');
  await openSection(page, 'Rueda de la Vida');
  await expectNoViolations(page, 'rueda con el acceso a metas');
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await expectNoViolations(page, 'inicio con metas');
});

test('welcome dialog, every step', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page, undefined, undefined, { onboarded: false });
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Te damos la bienvenida a CLAR' })).toBeVisible();
  await expectNoViolations(page, 'bienvenida: por qué');
  await dialog.getByRole('button', { name: 'Siguiente' }).click();
  await expectNoViolations(page, 'bienvenida: el método');
  await dialog.getByRole('button', { name: 'Siguiente' }).click();
  await expectNoViolations(page, 'bienvenida: cómo empezar');
});

test('guided tour bubble', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Ayuda', exact: true }).click();
  await expectNoViolations(page, 'guía con la guía rápida');
  await page.getByRole('button', { name: 'Repetir el recorrido' }).click();
  await expect(page.getByRole('dialog', { name: 'Captura una tarea' })).toBeVisible();
  await expectNoViolations(page, 'recorrido guiado');
});

test('contact dialog from the account menu and from the access request screen', async ({ page, browser }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await page.getByRole('button', { name: 'Tu cuenta' }).click();
  await page.getByRole('button', { name: 'Escríbenos: ideas, fallos o dudas' }).click();
  const dialog = page.getByRole('dialog', { name: 'Escríbenos' });
  await dialog.getByRole('checkbox', { name: /Adjuntar información técnica/ }).check();
  await expectNoViolations(page, 'contacto (con la información técnica a la vista)');

  // Sin acceso aprobado también se puede escribir
  const pending = await (await browser.newContext()).newPage();
  await pending.goto('/');
  await signInWithGoogle(pending, undefined, undefined, { approve: false });
  await expect(pending.getByRole('heading', { name: 'Solicita acceso' })).toBeVisible(SERVER_CALL);
  await pending.getByRole('button', { name: '¿Alguna duda o problema? Escríbenos' }).click();
  await expect(pending.getByRole('dialog', { name: 'Escríbenos' })).toBeVisible();
  await expectNoViolations(pending, 'contacto desde la solicitud de acceso');
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
  await page.getByRole('button', { name: /^Administración/ }).click();
  await expect(page.getByRole('heading', { name: 'Administración' })).toBeVisible();
  await expectNoViolations(page, 'accesos');
});

test('task alarm: the field in the form and the alert', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  const title = `Revisar el contrato ${Date.now().toString(36)}`;
  await page.getByRole('button', { name: 'Nueva tarea', exact: true }).click();
  await page.getByPlaceholder('ej. Llamar al proveedor para acordar el plazo de entrega').fill(title);
  // Vence mañana a las 00:01; la alarma a la misma hora es 24 h antes, hoy a las 00:01: ya pasó y avisa al guardar
  await page.getByLabel('Fecha límite', { exact: true }).fill(localDateFromToday(1));
  await page.getByLabel('Hora límite').fill('00:01');
  await page.getByLabel(/^Alarma/).fill('00:01');
  await expectNoViolations(page, 'formulario con alarma');
  await page.getByRole('button', { name: 'Guardar la tarea' }).click();
  await expect(page.getByRole('region', { name: `Alarma: ${title}` })).toBeVisible();
  await expectNoViolations(page, 'aviso de alarma');
});

test('e-mail drafts: the list and the editor with attachments', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await openSection(page, 'Tiempo protegido');
  await page.getByRole('button', { name: 'Escribir un correo' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Elegir archivos' }).click();
  await (await chooser).setFiles({ name: 'acta.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(2048) });
  await page.getByLabel(/^Paso 3: Asunto/).fill('Acta de la reunión');
  await expectNoViolations(page, 'correo con adjuntos');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Borradores (1)' })).toBeVisible();
  await expectNoViolations(page, 'tiempo protegido con borradores');
});

test('admin messages: the reply form and a sent reply', async ({ page }) => {
  const { idToken } = await createVerifiedAccount();
  const subject = `Duda sobre las metas ${Date.now().toString(36)}`;
  const sent = await callFunction('submitFeedback', idToken, { type: 'general', subject, description: 'Una duda.' });
  expect(sent.status).toBe(200);
  await page.goto('/');
  await signInWithGoogle(page, ADMIN_EMAIL);
  await page.getByRole('button', { name: /^Administración/ }).click();
  await page.getByRole('button', { name: /^Mensajes/ }).click();
  const item = page.getByRole('listitem', { name: `${subject} (Nuevo)` });
  await item.getByRole('button', { name: `Responder: ${subject}` }).click();
  await item.getByRole('textbox', { name: /^Respuesta para / }).fill('Se crean en la sección Metas.');
  await expectNoViolations(page, 'responder un mensaje');
  await item.getByRole('button', { name: 'Enviar respuesta' }).click();
  await expect(
    page.getByRole('listitem', { name: `${subject} (Leído)` }).getByRole('list', { name: /^Respuestas a / })
  ).toBeVisible(SERVER_CALL);
  await expectNoViolations(page, 'mensaje respondido');
});
