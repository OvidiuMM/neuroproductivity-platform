import { expect, test } from '@playwright/test';
import { RELEASE_NOTES } from '../../src/services/releaseNotes';
import {
  approveAccess,
  markOnboarded,
  openSection,
  readDocument,
  signInWithGoogle,
  uidOf,
  uniqueEmail
} from './helpers';

// Novedades de cada versión: se abren solas una vez tras una actualización (las cuentas nuevas empiezan por la
// bienvenida: ver welcome.spec.ts), y desde la versión y la Ayuda
const SERVER_CALL = { timeout: 15_000 };
const latest = RELEASE_NOTES[0];
const NOTES = `Novedades de la versión ${latest.version}`;
// La versión de la cabecera: su nombre empieza por lo que se ve
const VERSION_BUTTON = `v${latest.version}: novedades de esta versión`;

test('after an update an account sees the release notes once, and can open them again from the version', async ({
  page
}) => {
  const email = uniqueEmail();
  await page.goto('/');
  // Una cuenta que ya pasó la bienvenida y aún no ha visto las novedades de esta versión
  await signInWithGoogle(page, email, undefined, { approve: false, onboarded: false });
  await markOnboarded(email, { releaseNotes: false });
  await approveAccess(email, { onboarded: false });

  const dialog = page.getByRole('dialog', { name: NOTES });
  await expect(dialog).toBeVisible(SERVER_CALL);
  await expect(dialog).toContainText(latest.changes[0].title);
  await expect(dialog).toContainText(`Publicada en ${latest.month}`);
  await dialog.getByRole('button', { name: 'Entendido' }).click();
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(async () => (await readDocument(`users/${await uidOf(email)}`))?.releaseNotesSeen, SERVER_CALL)
    .toBe(latest.version);

  // No vuelve a salir sola, tampoco en otro dispositivo (sin la copia local: lo dice el perfil)
  const synced = page.getByRole('button', { name: /^Sincronizado con el servidor/ });
  await page.reload();
  await expect(synced).toBeVisible(SERVER_CALL);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage))
      if (key.startsWith('clar_release_notes:')) localStorage.removeItem(key);
  });
  await page.reload();
  await expect(synced).toBeVisible(SERVER_CALL);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // La versión de la cabecera las abre; Escape las cierra y el foco vuelve a la versión
  const version = page.getByRole('banner').getByRole('button', { name: VERSION_BUTTON });
  await version.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(version).toBeFocused();
});

test('the help shows the release notes of the current version', async ({ page }) => {
  await page.goto('/');
  await signInWithGoogle(page);
  await openSection(page, 'Ayuda');
  const notes = page.getByRole('region', { name: 'Novedades' });
  await expect(notes.getByRole('heading', { name: `Versión ${latest.version} · ${latest.month}` })).toBeVisible();
  for (const change of latest.changes) await expect(notes).toContainText(change.title);
});
