import { expect, test, type Page } from '@playwright/test';
import {
  deleteDocument,
  listDocuments,
  openSection,
  readDocument,
  signInWithGoogle,
  uidOf,
  uniqueEmail,
  writeTextDocument
} from './helpers';

// La cola de alarmas push la mantiene el trigger de las tareas (functions/src/push.ts). FCM no tiene emulador: aquí se
// prepara un dispositivo registrado a mano y se hace de envío apuntando la alarma como enviada.
test.use({ timezoneId: 'Europe/Madrid' });

const fromNow = (page: Page, minutes: number) =>
  page.evaluate((m) => {
    const d = new Date(Date.now() + m * 60_000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`
    };
  }, minutes);

test('an alarm already sent is not queued again when the task is edited, only when its alarm changes', async ({
  page
}) => {
  test.slow(); // Espera a los triggers del emulador
  const email = uniqueEmail();
  await page.goto('/');
  await signInWithGoogle(page, email);
  const uid = await uidOf(email);
  await writeTextDocument(`push_devices/${uid}`, { timeZone: 'Europe/Madrid' });
  await openSection(page, 'Listas');

  // Una tarea con una alarma que ya pasó, antes del plazo: entra en la cola
  const title = `Pagar el alquiler ${Date.now().toString(36)}`;
  const due = await fromNow(page, 60);
  await page.getByRole('button', { name: 'Nueva tarea', exact: true }).click();
  await page.getByPlaceholder('ej. Llamar al proveedor para acordar el plazo de entrega').fill(title);
  await page.getByLabel('Fecha límite', { exact: true }).fill(due.date);
  await page.getByLabel('Hora límite').fill(due.time);
  await page.getByLabel(/^Alarma/).fill((await fromNow(page, -3)).time);
  await page.getByRole('button', { name: 'Guardar la tarea' }).click();

  let taskId = '';
  await expect
    .poll(
      async () => {
        const tasks = await listDocuments(`users/${uid}/tasks`);
        taskId = tasks.find((t) => t.title === title)?.id ?? '';
        return taskId && (await readDocument(`alarm_queue/${uid}__${taskId}`))?.key;
      },
      { timeout: 15_000 }
    )
    .toBeTruthy();
  const queued = await readDocument(`alarm_queue/${uid}__${taskId}`);

  // Se envía: sale de la cola y queda apuntada como enviada
  await writeTextDocument(`alarm_sent/${uid}__${taskId}`, { uid, taskId, key: String(queued!.key) });
  await deleteDocument(`alarm_queue/${uid}__${taskId}`);

  // Editar la tarea (otra prioridad) no la vuelve a meter en la cola
  await page.getByRole('heading', { name: title }).click();
  await page
    .getByRole('dialog')
    .getByLabel(/^Prioridad/)
    .selectOption('HIGH');
  await page.getByRole('button', { name: 'Guardar los cambios' }).click();
  await expect
    .poll(async () => (await listDocuments(`users/${uid}/tasks`)).find((t) => t.id === taskId)?.priority, {
      timeout: 15_000
    })
    .toBe('HIGH');
  // Lo que se comprueba es que el trigger no escriba nada: no hay señal que esperar, solo el tiempo que tarda en correr
  await new Promise((resolve) => setTimeout(resolve, 3_000));
  expect(await readDocument(`alarm_queue/${uid}__${taskId}`)).toBeNull();

  // Otra hora de alarma es otra alarma: vuelve a la cola
  await page.getByRole('heading', { name: title }).click();
  await page.getByLabel(/^Alarma/).fill((await fromNow(page, 20)).time);
  await page.getByRole('button', { name: 'Guardar los cambios' }).click();
  await expect
    .poll(
      async () => {
        const key = (await readDocument(`alarm_queue/${uid}__${taskId}`))?.key;
        return key ? (key === queued!.key ? 'la misma' : 'otra') : 'ninguna';
      },
      { timeout: 15_000 }
    )
    .toBe('otra');
});
