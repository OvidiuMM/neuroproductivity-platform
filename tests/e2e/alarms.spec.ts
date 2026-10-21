import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { installClockAwayFromMidnight, openSection, showMoreOptions, signInWithGoogle } from './helpers';

test.use({ timezoneId: 'Europe/Madrid' });

// Notificaciones del sistema de prueba: se apuntan en window.__notifications. El permiso empieza sin decidir.
const fakeNotifications = (target: Page | BrowserContext, initial: NotificationPermission = 'default') =>
  target.addInitScript((start) => {
    // `source`: de la página (new Notification) o del service worker (registration.showNotification)
    const shown: { title: string; body?: string; source: 'page' | 'sw' }[] = [];
    let permission = start;
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
        shown.push({ title, body: options?.body, source: 'page' });
      }
      close() {}
    }
    Object.defineProperty(window, 'Notification', { value: FakeNotification, configurable: true });
    Object.defineProperty(window, '__notifications', { value: shown });
    // Las del service worker (las que usa CLAR cuando lo tiene registrado), también apuntadas
    if ('ServiceWorkerRegistration' in window)
      ServiceWorkerRegistration.prototype.showNotification = function (title: string, options?: NotificationOptions) {
        shown.push({ title, body: options?.body, source: 'sw' });
        return Promise.resolve();
      };
  }, initial);
const notifications = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __notifications: { title: string; body?: string; source: 'page' | 'sw' }[] })
        .__notifications
  );

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
  await installClockAwayFromMidnight(page);
  await page.goto('/');
  await signInWithGoogle(page);
  await openSection(page, 'Listas');

  const title = `Llamar al banco ${Date.now().toString(36)}`;
  const due = await fromNow(page, 30);
  const alarm = await fromNow(page, 2);
  await newTaskWithAlarm(page, title, due, alarm.time);
  await expect(page.getByText(new RegExp(`^Sonará (hoy|mañana) a las ${alarm.time}\\.`))).toBeVisible();
  await page.getByRole('button', { name: 'Activar también las notificaciones del sistema' }).click();
  await expect(page.getByText('También recibirás una notificación del sistema.')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar la tarea' }).click();

  // La tarjeta lleva la campana con el día y la hora
  const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: title }) });
  await expect(card).toContainText(new RegExp(`Alarma:(hoy|mañana) ${alarm.time}`));
  const alert = page.getByRole('region', { name: `Alarma: ${title}` });
  await expect(alert).toHaveCount(0);

  // A su hora, con una ventana abierta: la notificación del sistema sale ya y el aviso de la app espera a que se
  // cierre (fuera de la ventana no se llegaría a él con el teclado)
  await page.getByRole('button', { name: 'Nueva tarea', exact: true }).click();
  await page.clock.fastForward('03:00');
  await expect
    .poll(() => notifications(page))
    .toEqual([expect.objectContaining({ title: `Alarma de las ${alarm.time}: ${title}` })]);
  await expect(alert).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(`Vence: `);

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

test('an alarm that passed with CLAR closed warns on opening while the task is not due yet', async ({ page }) => {
  // Aunque el navegador no deje guardar las alarmas ya avisadas (almacenamiento lleno o bloqueado), avisa igual
  await page.addInitScript(() => {
    const original = Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem')!.value as Storage['setItem'];
    Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
      if (key.startsWith('clar_alarms_fired:')) throw new DOMException('Lleno', 'QuotaExceededError');
      original.call(this, key, value);
    };
  });
  await installClockAwayFromMidnight(page);
  await page.goto('/');
  await signInWithGoogle(page);
  await openSection(page, 'Listas');
  const title = `Enviar el informe ${Date.now().toString(36)}`;
  const alarmTime = (await fromNow(page, 2)).time;
  await newTaskWithAlarm(page, title, await fromNow(page, 20), alarmTime);
  await page.getByRole('button', { name: 'Guardar la tarea' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Antes de cerrar, la tarea está en el servidor (si no, al salir de la página se podría perder lo que aún no se
  // había escrito: en el CI, más lento, pasaba)
  await expect(page.getByRole('button', { name: /^Sincronizado con el servidor/ })).toBeVisible({ timeout: 15_000 });

  // CLAR se cierra antes de la hora de la alarma y se vuelve a abrir 5 minutos después
  await page.goto('about:blank');
  await page.clock.fastForward('05:00');
  await page.goto('/');
  await openSection(page, 'Listas');
  await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 15_000 });

  // El aviso dice su hora y, como llega tarde, cuándo era
  const alert = page.getByRole('region', { name: `Alarma: ${title}` });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(`Alarma · ${alarmTime}`);
  await expect(alert).toContainText(new RegExp(`Era (a las|el .+ a las) ${alarmTime}: CLAR no estaba abierta`));
  // Sin permiso de notificaciones, el aviso sale solo dentro de la app; se cierra con su botón
  await alert.getByRole('button', { name: `Cerrar la alarma de «${title}»` }).click();
  await expect(alert).toHaveCount(0);
});

test('an alarm needs a due date; it rings that day, before the due time if there is one, also when repeating', async ({
  page
}) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await openSection(page, 'Listas');
  await page.getByRole('button', { name: 'Nueva tarea', exact: true }).click();
  const alarmField = page.getByLabel(/^Alarma/);
  await expect(alarmField).toBeDisabled();
  await expect(alarmField).toHaveAccessibleDescription(/Pon una fecha límite para poder añadir una alarma\./);

  // Solo con fecha: ese día, a su hora
  await page.getByLabel('Fecha límite', { exact: true }).fill('2030-06-15');
  await expect(alarmField).toBeEnabled();
  await alarmField.fill('20:00');
  await expect(alarmField).toHaveAccessibleDescription(/^Sonará el 15 jun a las 20:00\./);

  // Repetida sin hora: también la lleva, cada repetición su día (desde el 10 de junio de 2030)
  await showMoreOptions(page);
  await page.getByLabel('Fecha de inicio', { exact: true }).fill('2030-06-10');
  await page.getByLabel('Repetir').selectOption('WEEKLY');
  await expect(alarmField).toBeEnabled();
  await expect(alarmField).toHaveValue('20:00');
  await expect(alarmField).toHaveAccessibleDescription(/^Sonará el .+ a las 20:00\./);

  // Con hora límite, tiene que ser antes: si no, lo dice y no deja guardar
  await page.getByLabel('Hora límite').fill('09:00');
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'La alarma tiene que ser antes de la hora límite (09:00): cámbiala o quítala.' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar la tarea' })).toBeDisabled();
  await alarmField.fill('08:30');
  await expect(alarmField).toHaveAccessibleDescription(/^Sonará el .+ a las 08:30\./);
});

test('an alarm saved after its time says it will not ring, and does not', async ({ page }) => {
  await fakeNotifications(page, 'granted');
  await installClockAwayFromMidnight(page);
  await page.goto('/');
  await signInWithGoogle(page);
  await openSection(page, 'Listas');
  const title = `Pagar la factura ${Date.now().toString(36)}`;
  const alarmTime = (await fromNow(page, -5)).time;
  await newTaskWithAlarm(page, title, await fromNow(page, 20), alarmTime);
  await expect(page.getByLabel(/^Alarma/)).toHaveAccessibleDescription(
    new RegExp(`^Esa hora ya ha pasado \\((hoy|el .+) a las ${alarmTime}\\): no sonará\\.`)
  );
  await page.getByRole('button', { name: 'Guardar la tarea' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Pasa un minuto: el aviso no sale
  await page.clock.fastForward('01:00');
  await expect(page.getByRole('region', { name: `Alarma: ${title}` })).toHaveCount(0);
  expect(await notifications(page)).toEqual([]);
});

test('with two tabs open, both show the alert and the system notification comes once', async ({ context }) => {
  test.slow(); // Dos pestañas
  await fakeNotifications(context, 'granted');
  const first = await context.newPage();
  await installClockAwayFromMidnight(first);
  await first.goto('/');
  await signInWithGoogle(first);
  await openSection(first, 'Listas');
  const second = await context.newPage();
  await installClockAwayFromMidnight(second);
  await second.goto('/');
  await openSection(second, 'Listas');

  const title = `Pagar la factura ${Date.now().toString(36)}`;
  await newTaskWithAlarm(first, title, await fromNow(first, 30), (await fromNow(first, 2)).time);
  await first.getByRole('button', { name: 'Guardar la tarea' }).click();
  await expect(second.getByRole('heading', { name: title })).toBeVisible();

  await first.clock.fastForward('03:00');
  await second.clock.fastForward('03:00');
  for (const page of [first, second])
    await expect(page.getByRole('region', { name: `Alarma: ${title}` })).toBeVisible();
  const shown = [...(await notifications(first)), ...(await notifications(second))];
  expect(shown.filter((n) => n.title.endsWith(`: ${title}`))).toHaveLength(1);
});

test('on Android the notification comes from the service worker, and the account menu offers to turn it on', async ({
  browser
}) => {
  test.slow(); // Contexto propio con el navegador de un móvil Android
  const context = await browser.newContext({
    timezoneId: 'Europe/Madrid',
    userAgent:
      'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'
  });
  await fakeNotifications(context);
  const page = await context.newPage();
  await installClockAwayFromMidnight(page);
  await page.goto('/');
  await signInWithGoogle(page);
  await expect
    .poll(() => page.evaluate(async () => Boolean(await navigator.serviceWorker.getRegistration())))
    .toBe(true);

  // Antes no se ofrecían en Android; ahora sí, también fuera del formulario
  await page.getByRole('button', { name: 'Tu cuenta' }).click();
  const account = page.getByRole('dialog', { name: 'Tu cuenta' });
  await account.getByRole('button', { name: 'Activar las notificaciones de las alarmas' }).click();
  await expect(account.getByText('También recibirás una notificación del sistema.')).toBeVisible();
  await account.getByRole('button', { name: 'Cerrar', exact: true }).click();

  await openSection(page, 'Listas');
  const title = `Recoger el paquete ${Date.now().toString(36)}`;
  await newTaskWithAlarm(page, title, await fromNow(page, 30), (await fromNow(page, 2)).time);
  await page.getByRole('button', { name: 'Guardar la tarea' }).click();
  await page.clock.fastForward('03:00');
  await expect(page.getByRole('region', { name: `Alarma: ${title}` })).toBeVisible();
  // Una sola, y desde el service worker: Chrome en Android no admite las de la página
  const alarm = (await notifications(page)).filter((n) => n.title.endsWith(`: ${title}`));
  expect(alarm.map((n) => n.source)).toEqual(['sw']);
  await context.close();
});

test('times are written in 24 hours; half-written or impossible ones are not saved', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await openSection(page, 'Listas');
  const title = `Recoger el paquete ${Date.now().toString(36)}`;
  await page.getByRole('button', { name: 'Nueva tarea', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Nueva tarea' });
  await page.getByPlaceholder('ej. Llamar al proveedor para acordar el plazo de entrega').fill(title);
  await page.getByLabel('Fecha límite', { exact: true }).fill('2030-06-15');

  // «7 pm» no es una hora en 24 h: se marca y no deja guardar
  const dueTime = page.getByLabel('Hora límite');
  await dueTime.fill('7 pm');
  await expect(dueTime).toHaveAttribute('aria-invalid', 'true');
  await form.getByRole('button', { name: 'Guardar la tarea' }).click();
  await expect(form).toBeVisible();

  // 930 se lee como 09:30, y 915 como 09:15: la alarma suena ese día a las 09:15
  await dueTime.fill('930');
  await dueTime.blur();
  await expect(dueTime).toHaveValue('09:30');
  const alarm = page.getByLabel(/^Alarma/);
  await alarm.fill('915');
  await alarm.blur();
  await expect(alarm).toHaveValue('09:15');
  await expect(alarm).toHaveAccessibleDescription(/^Sonará el 15 jun a las 09:15\./);
  await form.getByRole('button', { name: 'Guardar la tarea' }).click();
  await expect(form).toBeHidden();
  const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: title }) });
  await expect(card).toContainText('Alarma:15 jun 09:15');
});
