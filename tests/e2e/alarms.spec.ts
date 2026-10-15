import { expect, test, type Page } from '@playwright/test';
import { openSection, showMoreOptions, signInWithGoogle } from './helpers';

test.use({ timezoneId: 'Europe/Madrid' });

// Notificaciones del sistema de prueba: se apuntan en window.__notifications. El permiso empieza sin decidir.
const fakeNotifications = (page: Page) =>
  page.addInitScript(() => {
    const shown: { title: string; body?: string }[] = [];
    let permission: NotificationPermission = 'default';
    class FakeNotification {
      static get permission() {
        return permission;
      }
      static requestPermission() {
        permission = 'granted';
        return Promise.resolve(permission);
      }
      onclick: (() => void) | null = null;
      constructor(title: string, options?: NotificationOptions) {
        shown.push({ title, body: options?.body });
      }
      close() {}
    }
    Object.defineProperty(window, 'Notification', { value: FakeNotification, configurable: true });
    Object.defineProperty(window, '__notifications', { value: shown });
  });
const notifications = (page: Page) =>
  page.evaluate(() => (window as unknown as { __notifications: { title: string; body?: string }[] }).__notifications);

// Fecha y horas locales a N minutos de ahora (en el reloj de la página)
const fromNow = (page: Page, minutes: number) =>
  page.evaluate((m) => {
    const d = new Date(Date.now() + m * 60_000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`
    };
  }, minutes);

const newTaskWithAlarm = async (page: Page, title: string, due: { date: string; time: string }, alarm: string) => {
  await page.getByRole('button', { name: 'Nueva tarea', exact: true }).click();
  await page.getByPlaceholder('ej. Llamar al proveedor para acordar el plazo de entrega').fill(title);
  await page.getByLabel('Fecha límite', { exact: true }).fill(due.date);
  await page.getByLabel('Hora límite').fill(due.time);
  await page.getByLabel(/^Alarma/).fill(alarm);
};

test('an alarm warns in CLAR and with a system notification, only once', async ({ page }) => {
  test.slow(); // Recarga la página
  await fakeNotifications(page);
  await page.clock.install();
  await page.goto('/');
  await signInWithGoogle(page);
  await openSection(page, 'Listas');

  const title = `Llamar al banco ${Date.now().toString(36)}`;
  const due = await fromNow(page, 30);
  const alarm = await fromNow(page, 2);
  await newTaskWithAlarm(page, title, due, alarm.time);
  await expect(page.getByText(new RegExp(`^Sonará (el|la víspera).*${alarm.time}\\.`))).toBeVisible();
  await page.getByRole('button', { name: 'Activar también las notificaciones del sistema' }).click();
  await expect(page.getByText('También recibirás una notificación del sistema.')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar la tarea' }).click();

  // La tarjeta lleva la campana con la hora
  const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: title }) });
  await expect(card).toContainText(`Alarma:${alarm.time}`);
  const alert = page.getByRole('region', { name: `Alarma: ${title}` });
  await expect(alert).toHaveCount(0);

  // A su hora: aviso dentro de la app y notificación del sistema
  await page.clock.fastForward('03:00');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(`Vence: `);
  expect(await notifications(page)).toEqual([expect.objectContaining({ title: `Alarma: ${title}` })]);

  // «Ver tarea» la abre para editarla y quita el aviso
  await alert.getByRole('button', { name: 'Ver tarea' }).click();
  const editor = page.getByRole('dialog', { name: 'Editar la tarea' });
  await expect(editor.getByLabel(/^Alarma/)).toHaveValue(alarm.time);
  await page.keyboard.press('Escape');
  await expect(alert).toHaveCount(0);

  // Al recargar no vuelve a sonar
  const reloaded = page.waitForEvent('load');
  await page.reload();
  await reloaded;
  await openSection(page, 'Listas');
  await expect(card).toBeVisible();
  await page.clock.fastForward('01:00');
  await expect(alert).toHaveCount(0);
  expect(await notifications(page)).toEqual([]);
});

test('an alarm whose time already passed warns at once while the task is not due yet', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await openSection(page, 'Listas');
  const title = `Enviar el informe ${Date.now().toString(36)}`;
  await newTaskWithAlarm(page, title, await fromNow(page, 20), (await fromNow(page, -1)).time);
  await page.getByRole('button', { name: 'Guardar la tarea' }).click();

  const alert = page.getByRole('region', { name: `Alarma: ${title}` });
  await expect(alert).toBeVisible();
  // Sin permiso de notificaciones, el aviso sale solo dentro de la app; se cierra con su botón
  await alert.getByRole('button', { name: `Cerrar la alarma de «${title}»` }).click();
  await expect(alert).toHaveCount(0);
});

test('a repeating task needs a due time for an alarm; with only a date it rings the day before', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await openSection(page, 'Listas');
  await page.getByRole('button', { name: 'Nueva tarea', exact: true }).click();
  const alarmField = page.getByLabel(/^Alarma/);
  await expect(alarmField).toBeDisabled();
  await expect(alarmField).toHaveAccessibleDescription(/Pon una fecha límite para poder añadir una alarma\./);

  // Solo con fecha: la víspera
  await page.getByLabel('Fecha límite', { exact: true }).fill('2030-06-15');
  await expect(alarmField).toBeEnabled();
  await alarmField.fill('20:00');
  await expect(alarmField).toHaveAccessibleDescription(/^Sonará la víspera, el 14 jun, a las 20:00\./);

  // Repetida sin hora: no puede llevar alarma hasta tener hora límite
  await showMoreOptions(page);
  await page.getByLabel('Repetir').selectOption('WEEKLY');
  await expect(alarmField).toBeDisabled();
  await expect(alarmField).toHaveAccessibleDescription(
    /Pon una hora límite para añadir una alarma a una tarea que se repite\./
  );
  await page.getByLabel('Hora límite').fill('09:00');
  await expect(alarmField).toBeEnabled();
  await expect(alarmField).toHaveValue('20:00');
  await expect(alarmField).toHaveAccessibleDescription(/^Sonará /);
});
