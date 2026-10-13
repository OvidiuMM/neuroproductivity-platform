import { expect, type Page } from '@playwright/test';

// Cada test usa una cuenta nueva en el emulador de Auth para no compartir datos
export const uniqueEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

const EMULATOR_PROJECT = 'demo-neuroproductivity';
// Cuenta que hace de administración en los emuladores (DEMO_ADMIN_EMAIL en functions/src/accessLogic.ts)
export const ADMIN_EMAIL = 'admin@example.com';

// Aprueba el acceso de una cuenta escribiendo access/{uid} en el emulador como lo haría la Cloud Function.
// "Bearer owner" es la credencial de administración de los emuladores y salta las reglas.
export const approveAccess = async (email: string) => {
  const headers = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
  // La cuenta aparece en el emulador de Auth al terminar el inicio de sesión: se reintenta hasta encontrarla
  let uid: string | undefined;
  await expect
    .poll(
      async () => {
        const lookup = await fetch(
          `http://127.0.0.1:9399/identitytoolkit.googleapis.com/v1/projects/${EMULATOR_PROJECT}/accounts:lookup`,
          { method: 'POST', headers, body: JSON.stringify({ email: [email] }) }
        );
        uid = (await lookup.json()).users?.[0]?.localId;
        return uid;
      },
      { message: `cuenta ${email} en el emulador de Auth` }
    )
    .toBeTruthy();
  const text = (value: string) => ({ stringValue: value });
  const now = new Date().toISOString();
  const res = await fetch(
    `http://127.0.0.1:8281/v1/projects/${EMULATOR_PROJECT}/databases/(default)/documents/access/${uid}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        fields: {
          status: text('approved'),
          email: text(email),
          name: text(''),
          photoUrl: text(''),
          message: text(''),
          requestedAt: text(now),
          decidedAt: text(now)
        }
      })
    }
  );
  expect(res.ok, await res.text()).toBe(true);
};

// Inicio de sesión con Google a través de la ventana emergente del emulador de Auth. Por defecto aprueba
// el acceso de la cuenta para entrar directamente en la app; con approve: false se queda en la solicitud.
export const signInWithGoogle = async (
  page: Page,
  email = uniqueEmail(),
  name = 'Persona de Prueba',
  { approve = true }: { approve?: boolean } = {}
) => {
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
  if (approve) {
    await approveAccess(email);
    await expect(page.getByRole('button', { name: 'Tu cuenta' })).toBeVisible();
  }
  return email;
};

// Fecha local (YYYY-MM-DD) a N días de hoy; los campos de fecha la aceptan escrita así
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
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  estimateMinutes?: number;
  repeat?: { frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'; monthlyOption?: string | RegExp };
}

// Rellena y guarda el formulario de tarea, que ya debe estar abierto
export const fillAndSaveTask = async (page: Page, task: NewTask) => {
  await page.getByPlaceholder('ej. Llamar al proveedor para acordar el plazo de entrega').fill(task.title);
  await page
    .getByPlaceholder('Detalla el resultado esperado, personas involucradas o requerimientos físicos previos...')
    .fill('Confirmar la fecha y hora de entrega.');
  if (task.dueDate) await page.getByLabel('Fecha límite', { exact: true }).fill(task.dueDate);
  if (task.dueTime) await page.getByLabel('Hora límite').fill(task.dueTime);
  if (task.startDate) await page.getByLabel('Fecha de inicio', { exact: true }).fill(task.startDate);
  if (task.priority) await page.getByLabel('Nivel de Prioridad').selectOption(task.priority);
  if (task.estimateMinutes) await page.getByLabel('Estimación (duración)').selectOption(String(task.estimateMinutes));
  if (task.repeat) {
    await page.getByLabel('Repetir').selectOption(task.repeat.frequency);
    if (task.repeat.monthlyOption) await page.getByRole('radio', { name: task.repeat.monthlyOption }).check();
  }
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

// Ningún elemento visible tiene contenido que se salga de su caja (p. ej. una cifra más ancha que su tarjeta)
export const expectNoInnerOverflow = async (page: Page, where: string) => {
  const offenders = await page.evaluate(() =>
    [...document.querySelectorAll('header *, main *')]
      // Los elementos SVG no son cajas: su scrollWidth no indica desbordamiento
      .filter((el) => !(el instanceof SVGElement))
      .filter((el) => getComputedStyle(el).overflowX === 'visible' && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1)
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}«${(el.textContent ?? '').trim().slice(0, 30)}» ${el.scrollWidth}>${el.clientWidth}`)
  );
  expect(offenders, where).toEqual([]);
};
