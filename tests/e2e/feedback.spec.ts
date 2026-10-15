import { expect, test } from '@playwright/test';
import {
  ADMIN_EMAIL,
  callFunction,
  createVerifiedAccount,
  listDocuments,
  openSection,
  signInWithGoogle
} from './helpers';

// Esperas que pasan por una Cloud Function del emulador
const SERVER_CALL = { timeout: 15_000 };

test('a person writes from the help with the technical details and the admin replies from CLAR and closes it', async ({
  browser
}) => {
  test.slow(); // Dos sesiones y varias llamadas a funciones
  const page = await browser.newPage();
  await page.goto('/');
  const email = await signInWithGoogle(page);
  const subject = `La agenda no carga ${Date.now().toString(36)}`;

  await openSection(page, 'Ayuda');
  await page.getByRole('button', { name: 'Escríbenos' }).click();
  const dialog = page.getByRole('dialog', { name: 'Escríbenos' });
  await expect(dialog.getByLabel('Asunto')).toBeFocused();
  await dialog.getByRole('radio', { name: 'Error o fallo' }).check();
  await dialog.getByLabel('Asunto').fill(subject);
  await dialog.getByLabel('Descripción').fill('Al abrir la agenda se queda en blanco.');
  await expect(dialog.getByText('38/2000 caracteres')).toBeVisible();

  // La información técnica es opcional y se ve antes de enviarla
  await expect(dialog.getByText('Versión de CLAR')).toBeHidden();
  await dialog.getByRole('checkbox', { name: /Adjuntar información técnica/ }).check();
  await expect(dialog.getByText('Versión de CLAR')).toBeVisible();
  await expect(dialog.getByText('Chrome', { exact: false })).toBeVisible();

  await dialog.getByRole('button', { name: 'Enviar' }).click();
  await expect(dialog.getByRole('heading', { name: '¡Gracias! Hemos recibido tu mensaje.' })).toBeFocused(SERVER_CALL);
  await dialog.getByRole('button', { name: 'Cerrar' }).first().click();
  await expect(dialog).toBeHidden();

  // Queda guardado con quién lo escribe, sin el user-agent completo
  const [ticket] = (await listDocuments('feedback_tickets')).filter((t) => t.subject === subject);
  expect(ticket).toMatchObject({ type: 'bug', email, status: 'new' });
  expect(JSON.stringify(ticket)).not.toContain('Mozilla');

  // La administración lo ve en «Mensajes», lo marca como leído y lo cierra
  const admin = await browser.newPage();
  await admin.goto('/');
  await signInWithGoogle(admin, ADMIN_EMAIL);
  await admin.getByRole('button', { name: /^Administración/ }).click();
  await admin.getByRole('button', { name: /^Mensajes/ }).click();
  const item = admin.getByRole('listitem', { name: `${subject} (Nuevo)` });
  await expect(item).toContainText('Al abrir la agenda se queda en blanco.');
  await expect(item).toContainText(/Chrome \d+/);
  // También se puede responder desde el programa de correo
  await expect(item.getByRole('link', { name: `Responder desde mi correo: ${subject}` })).toHaveAttribute(
    'href',
    `mailto:${email}?subject=${encodeURIComponent(`Re: ${subject}`)}`
  );

  // Responder desde CLAR: se envía por email y queda en el mensaje, que pasa a leído
  await item.getByRole('button', { name: `Responder: ${subject}` }).click();
  const answer = item.getByRole('textbox', { name: /^Respuesta para / });
  await expect(answer).toBeFocused();
  await expect(item.getByRole('button', { name: 'Enviar respuesta' })).toBeDisabled();
  await answer.fill('Gracias por avisar. Ya está arreglado: recarga la página.');
  await item.getByRole('button', { name: 'Enviar respuesta' }).click();
  const read = admin.getByRole('listitem', { name: `${subject} (Leído)` });
  await expect(read.getByRole('list', { name: `Respuestas a «${subject}»` })).toContainText(
    'Gracias por avisar. Ya está arreglado: recarga la página.',
    SERVER_CALL
  );
  await expect(read.getByRole('status')).toHaveText('Respuesta enviada.');
  await expect(read.getByRole('button', { name: `Responder: ${subject}` })).toBeFocused();
  const [replied] = (await listDocuments('feedback_tickets')).filter((t) => t.subject === subject);
  expect(replied.status).toBe('read');
  // listDocuments solo descodifica el primer nivel: la respuesta va dentro de la lista tal como la guarda Firestore
  expect(JSON.stringify(replied.replies)).toContain('Gracias por avisar. Ya está arreglado: recarga la página.');

  await read.getByRole('button', { name: `Cerrar: ${subject}` }).click();
  await expect(admin.getByRole('listitem', { name: new RegExp(subject) })).toHaveCount(0);

  // Los cerrados se cargan al pedirlos, y desde ahí se puede reabrir
  const closed = admin.getByRole('region', { name: /^Cerrados/ });
  await closed.getByRole('button', { name: 'Ver los cerrados' }).click();
  const closedItem = closed.getByRole('listitem', { name: `${subject} (Cerrado)` });
  await expect(closedItem).toBeVisible();
  await closedItem.getByRole('button', { name: `Reabrir: ${subject}` }).click();
  await expect(closedItem).toBeHidden();
  await expect(
    admin.getByRole('region', { name: /^Abiertos/ }).getByRole('listitem', { name: `${subject} (Leído)` })
  ).toBeVisible();
});

test('the server asks for a confirmed email, allows five messages an hour and forgets them with the account', async () => {
  const message = { type: 'general', subject: 'Hola', description: 'Una prueba.' };

  // Sin email confirmado, no
  const signUp = await fetch(
    'http://127.0.0.1:9399/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `sin-confirmar-${Date.now()}@example.com`,
        password: 'clave-segura-1',
        returnSecureToken: true
      })
    }
  );
  const { idToken: unverified } = (await signUp.json()) as { idToken: string };
  expect((await callFunction('submitFeedback', unverified, message)).status).toBe(403);

  // Con email confirmado: cinco por hora, y el sexto se rechaza
  const { uid, idToken } = await createVerifiedAccount();
  // Responder mensajes es solo para la administración
  expect((await callFunction('replyToFeedback', idToken, { ticketId: 'cualquiera', message: 'Hola' })).status).toBe(
    403
  );
  for (let i = 0; i < 5; i++) expect((await callFunction('submitFeedback', idToken, message)).status).toBe(200);
  const sixth = await callFunction('submitFeedback', idToken, message);
  expect(sixth.status).toBe(429);
  expect(((await sixth.json()) as { error: { status: string } }).error.status).toBe('RESOURCE_EXHAUSTED');
  // Un mensaje mal formado tampoco pasa
  expect((await callFunction('submitFeedback', idToken, { type: 'spam', subject: '', description: '' })).status).toBe(
    400
  );
  expect((await listDocuments('feedback_tickets')).filter((t) => t.uid === uid)).toHaveLength(5);

  // Al eliminar la cuenta (forgetAccess) se borran sus mensajes, pero no el límite de la última hora: borrar la cuenta
  // a medias no sirve para seguir enviando
  expect((await callFunction('forgetAccess', idToken, {})).status).toBe(200);
  expect((await listDocuments('feedback_tickets')).filter((t) => t.uid === uid)).toHaveLength(0);
  expect((await callFunction('submitFeedback', idToken, message)).status).toBe(429);
});
