import { expect, test, type Page } from '@playwright/test';
import { openSection, signInWithGoogle } from './helpers';

const openEmailTool = async (page: Page) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await openSection(page, 'Tiempo protegido');
};

// «Elegir archivos» abre el selector del sistema; se apuntan el nombre y el tamaño reales
const pickFiles = async (page: Page, files: { name: string; bytes: number }[]) => {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Elegir archivos' }).click();
  await (
    await chooser
  ).setFiles(
    files.map(({ name, bytes }) => ({ name, mimeType: 'application/octet-stream', buffer: Buffer.alloc(bytes) }))
  );
};

test('the attach button opens the file picker and keeps only the name and size', async ({ page }) => {
  await openEmailTool(page);
  await page.getByRole('button', { name: 'Escribir un correo' }).click();
  await pickFiles(page, [
    { name: 'balance.xlsx', bytes: 1300 },
    { name: 'informe.pdf', bytes: 2 * 1024 * 1024 }
  ]);
  const list = page.getByRole('list', { name: 'Archivos que adjuntar' });
  await expect(list.getByRole('listitem')).toHaveText(['balance.xlsx (1,3 KB)', 'informe.pdf (2 MB)']);
  // El mismo archivo dos veces no se repite; quitado, se puede volver a elegir
  await pickFiles(page, [{ name: 'balance.xlsx', bytes: 1300 }]);
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await page.getByRole('button', { name: 'Quitar el adjunto balance.xlsx' }).click();
  await pickFiles(page, [{ name: 'balance.xlsx', bytes: 1300 }]);
  await expect(list.getByRole('listitem')).toHaveCount(2);
});

test('an unfinished e-mail becomes a draft, and can be continued, saved, reopened and deleted', async ({ page }) => {
  await openEmailTool(page);
  const subject = `Previsión del trimestre ${Date.now().toString(36)}`;

  // Cerrar sin escribir nada no guarda nada
  await page.getByRole('button', { name: 'Escribir un correo' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: /^Borradores/ })).toHaveCount(0);

  // Cerrar con algo escrito lo guarda como borrador
  await page.getByRole('button', { name: 'Escribir un correo' }).click();
  await pickFiles(page, [{ name: 'prevision.xlsx', bytes: 4096 }]);
  await page.getByLabel(/^Paso 3: Asunto/).fill(subject);
  await page.getByLabel(/^Paso 2: Cuerpo/).fill('Te paso la previsión');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Lo que escribiste se guardó como borrador.')).toBeVisible();
  const drafts = page.getByRole('region', { name: 'Borradores (1)' });
  await expect(drafts).toContainText(subject);

  // «Continuar» lo abre como estaba y se termina
  await drafts.getByRole('button', { name: `Continuar el borrador «${subject}»` }).click();
  const editor = page.getByRole('dialog', { name: 'Continuar el borrador' });
  await expect(editor.getByLabel(/^Paso 3: Asunto/)).toHaveValue(subject);
  await expect(editor.getByRole('list', { name: 'Archivos que adjuntar' })).toContainText('prevision.xlsx (4 KB)');
  await editor.getByLabel(/^Paso 2: Cuerpo/).fill('Te paso la previsión del trimestre para revisarla.');
  await editor.getByLabel(/^Paso 4: Destinatarios/).fill('ana@example.com');
  // «Abrir en mi correo» lo pasa al programa de correo
  await expect(editor.getByRole('link', { name: 'Abrir en mi correo' })).toHaveAttribute(
    'href',
    /^mailto:ana@example\.com\?subject=Previsi%C3%B3n%20del%20trimestre%20.+&body=Te%20paso/
  );
  await editor.getByRole('button', { name: 'Guardar el correo' }).click();
  await expect(page.getByText('Correo guardado.')).toBeVisible();
  await expect(page.getByRole('region', { name: /^Borradores/ })).toHaveCount(0);
  const saved = page.getByRole('region', { name: 'Guardados (1)' });
  await expect(saved).toContainText(subject);
  await expect(saved).toContainText('Para: ana@example.com');

  // Abrirlo y cerrarlo sin cambios no crea un borrador
  await saved.getByRole('button', { name: `Abrir el correo «${subject}»` }).click();
  await expect(page.getByRole('dialog', { name: 'Editar el correo' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: /^Borradores/ })).toHaveCount(0);

  // Eliminar, con «Deshacer»
  await saved.getByRole('button', { name: `Eliminar el correo «${subject}»` }).click();
  await expect(page.getByText('No hay correos guardados.')).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByRole('region', { name: 'Guardados (1)' })).toContainText(subject);
});

test('«Guardar borrador» keeps an e-mail that is just started', async ({ page }) => {
  await openEmailTool(page);
  await page.getByRole('button', { name: 'Escribir un correo' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo correo' });
  await expect(dialog.getByRole('button', { name: 'Guardar borrador' })).toBeDisabled();
  await dialog.getByLabel(/^Paso 3: Asunto/).fill('Idea para el viernes');
  await dialog.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByText('Borrador guardado. Lo tienes en «Borradores».')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Borradores (1)' })).toContainText('Idea para el viernes');
});
