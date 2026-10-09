import { expect, type Page } from '@playwright/test';

// Cada test usa una cuenta nueva en el emulador de Auth para no compartir datos
export const uniqueEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

// Inicio de sesión con Google a través de la ventana emergente del emulador de Auth
export const signInWithGoogle = async (page: Page, email = uniqueEmail(), name = 'Persona de Prueba') => {
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Continuar con Google' }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState('load');
  // El botón solo responde cuando el script de la ventana ya está registrado; se reintenta hasta ver el formulario
  await expect(async () => {
    await popup.locator('#add-account-button').click();
    await expect(popup.locator('#email-input')).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await popup.locator('#email-input').fill(email);
  await popup.locator('#display-name-input').fill(name);
  await popup.locator('#sign-in').click();
  await expect(page.getByRole('button', { name: 'Tu cuenta' })).toBeVisible();
  return email;
};

// Fecha local (YYYY-MM-DD) a N días de hoy, como la escriben los campos de fecha
export const localDateFromToday = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

interface NewTask {
  title: string;
  dueDate?: string;
  dueTime?: string;
  startDate?: string;
}

// Rellena y guarda el formulario de tarea, que ya debe estar abierto
export const fillAndSaveTask = async (page: Page, task: NewTask) => {
  await page.getByPlaceholder('ej. Llamar al proveedor para acordar el plazo de entrega').fill(task.title);
  await page
    .getByPlaceholder('Detalla el resultado esperado, personas involucradas o requerimientos físicos previos...')
    .fill('Confirmar la fecha y hora de entrega.');
  if (task.dueDate) await page.getByLabel('Fecha límite', { exact: true }).fill(task.dueDate);
  if (task.dueTime) await page.getByLabel('Hora límite').fill(task.dueTime);
  if (task.startDate) await page.getByLabel('Fecha de inicio').fill(task.startDate);
  const saveButton = page.getByRole('button', { name: 'Guardar Acción Operativa' });
  await saveButton.scrollIntoViewIfNeeded();
  await saveButton.click();
  await expect(saveButton).toBeHidden();
};

export const expectNoHorizontalOverflow = async (page: Page, where: string) => {
  const overflow = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > width + 1)
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).slice(0, 60)}`);
    return { scrollWidth: document.documentElement.scrollWidth, width, offenders };
  });
  expect(overflow.scrollWidth, `${where}: ${overflow.offenders.join(' | ')}`).toBeLessThanOrEqual(overflow.width);
};
