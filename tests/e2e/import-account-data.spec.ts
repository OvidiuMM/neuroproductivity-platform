import { writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { fillAndSaveTask, openSection, signInWithGoogle } from './helpers';

const openAccount = async (page: Page) => {
  await page.getByRole('button', { name: 'Tu cuenta' }).click();
  return page.getByRole('dialog', { name: 'Tu cuenta' });
};

// Elige el archivo en «Importar datos (JSON)» del menú de la cuenta
const importFile = async (page: Page, path: string) => {
  const account = await openAccount(page);
  const chooser = page.waitForEvent('filechooser');
  await account.getByRole('button', { name: 'Importar datos (JSON)' }).click();
  await (await chooser).setFiles(path);
  return account;
};

test('the account download is imported into another account, and importing it again adds nothing', async ({
  browser
}, testInfo) => {
  test.slow(); // Dos cuentas, una descarga y tres importaciones
  const stamp = Date.now().toString(36);
  const goalTitle = `Correr una media maratón ${stamp}`;
  const taskTitle = `Salir a correr cinco kilómetros ${stamp}`;

  // Cuenta de origen: una tarea vinculada a una meta nueva
  const source = await (await browser.newContext()).newPage();
  await source.goto('/');
  await signInWithGoogle(source);
  await source.getByRole('button', { name: 'Nueva tarea', exact: true }).click();
  const form = source.getByRole('dialog');
  await form.getByRole('button', { name: 'Nueva meta', exact: true }).click();
  await form.getByLabel('Nombre de la nueva meta').fill(goalTitle);
  await form.getByLabel('Área de la nueva meta').selectOption({ label: 'Salud' });
  await form.getByRole('button', { name: 'Crear la meta' }).click();
  await fillAndSaveTask(source, { title: taskTitle });

  const account = await openAccount(source);
  const download = source.waitForEvent('download');
  await account.getByRole('button', { name: 'Descargar mis datos (JSON)' }).click();
  const file = testInfo.outputPath('clar.json');
  await (await download).saveAs(file);
  await account.getByRole('button', { name: 'Cerrar', exact: true }).click();

  // En la misma cuenta no entra nada: ya está todo
  await importFile(source, file);
  const sameAccount = source.getByRole('dialog', { name: 'Importar datos' });
  await expect(sameAccount).toContainText('Ya tienes en tu cuenta todo lo de este archivo.');
  await expect(sameAccount.getByRole('row', { name: /^Tareas/ })).toHaveText(/Tareas\s*0\s*1\s*0/);
  await expect(sameAccount.getByRole('button', { name: /^Importar/ })).toHaveCount(0);
  await sameAccount.getByRole('button', { name: 'Cerrar', exact: true }).last().click();
  await expect(sameAccount).toBeHidden();
  // El foco vuelve al botón de la cuenta
  await expect(source.getByRole('button', { name: 'Tu cuenta' })).toBeFocused();

  // Otra cuenta: la vista previa cuenta lo nuevo y, al importar, la tarea y la meta están
  const target = await (await browser.newContext()).newPage();
  await target.goto('/');
  await signInWithGoogle(target);
  await importFile(target, file);
  const preview = target.getByRole('dialog', { name: 'Importar datos' });
  await expect(preview.getByRole('row', { name: /^Metas/ })).toHaveText(/Metas\s*1\s*0\s*0/);
  await expect(preview.getByRole('row', { name: /^Tareas/ })).toHaveText(/Tareas\s*1\s*0\s*0/);
  await preview.getByRole('button', { name: 'Importar 2 elementos' }).click();
  await expect(preview).toBeHidden();
  await expect(target.getByRole('status').filter({ hasText: 'Importado' })).toHaveText('Importado: 2 elementos.');
  await openSection(target, 'Listas');
  await expect(target.getByRole('main')).toContainText(taskTitle);
  await openSection(target, 'Metas');
  await expect(target.getByRole('list', { name: `Tareas por hacer de «${goalTitle}»` })).toContainText(taskTitle);

  // Importarlo otra vez no duplica nada
  await importFile(target, file);
  await expect(preview).toContainText('Ya tienes en tu cuenta todo lo de este archivo.');
});

test('a file that is not the account download is refused with the reason', async ({ page }, testInfo) => {
  await page.goto('/');
  await signInWithGoogle(page);
  const single = testInfo.outputPath('tarea.json');
  await writeFile(single, JSON.stringify({ app: 'CLAR', version: '0.9.5', type: 'task', task: { id: 'task-1' } }));
  const account = await importFile(page, single);
  await expect(account.getByRole('alert')).toHaveText(
    'Este archivo es la descarga de una sola tarea, meta o proyecto. Aquí se importa la de «Descargar mis datos (JSON)».'
  );
  const broken = testInfo.outputPath('roto.json');
  await writeFile(broken, '{ esto no es JSON');
  const chooser = page.waitForEvent('filechooser');
  await account.getByRole('button', { name: 'Importar datos (JSON)' }).click();
  await (await chooser).setFiles(broken);
  await expect(account.getByRole('alert')).toHaveText('El archivo no es un JSON válido.');
  await expect(page.getByRole('dialog', { name: 'Importar datos' })).toHaveCount(0);
});
