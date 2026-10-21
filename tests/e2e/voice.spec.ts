import { expect, test, type Page } from '@playwright/test';
import { approveAccess, markOnboarded, openSection, showMoreOptions, signInWithGoogle, uniqueEmail } from './helpers';

// Dictar con el micrófono (Web Speech API). El reconocimiento de voz de verdad necesita micrófono y conexión con
// Google: aquí se sustituye por uno que «oye» la frase dada, primero a medias y después entera, o que falla con el
// error dado («error:not-allowed»)
const fakeSpeech = (page: Page, phrase: string | null) =>
  page.addInitScript((text) => {
    type Results = {
      length: number;
      [i: number]: { isFinal: boolean; length: number; [j: number]: { transcript: string } };
    };
    const resultsOf = (transcript: string, isFinal: boolean): Results =>
      Object.assign([Object.assign([{ transcript }], { isFinal })], { length: 1 });
    const w = window as unknown as Record<string, unknown> & { __dictations?: number };
    // Chromium trae los dos (con prefijo y sin él): se sustituyen, o se quitan para probar un navegador sin dictado
    for (const name of ['SpeechRecognition', 'webkitSpeechRecognition'])
      Object.defineProperty(window, name, { value: undefined, configurable: true, writable: true });
    if (text === null) return;
    w.SpeechRecognition = class {
      lang = '';
      interimResults = false;
      continuous = false;
      maxAlternatives = 1;
      onstart: (() => void) | null = null;
      onresult: ((event: { results: Results }) => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        w.__dictations = (w.__dictations ?? 0) + 1;
        if (text.startsWith('error:')) {
          setTimeout(() => {
            this.onerror?.({ error: text.slice('error:'.length) });
            this.onend?.();
          }, 50);
          return;
        }
        setTimeout(() => {
          this.onstart?.();
          this.onresult?.({ results: resultsOf(text.split(' ').slice(0, 2).join(' '), false) });
          setTimeout(() => {
            this.onresult?.({ results: resultsOf(text, true) });
            this.onend?.();
          }, 100);
        }, 50);
      }
      stop() {
        this.onend?.();
      }
      abort() {}
    };
  }, phrase);

test('the microphone dictates the title and a note of a task', async ({ page }) => {
  await fakeSpeech(page, 'Comprar pan para la cena');
  await page.goto('/');
  await signInWithGoogle(page);
  await openSection(page, 'Listas');
  await page.getByRole('button', { name: 'Añadir la primera tarea' }).click();
  const form = page.getByRole('dialog', { name: 'Nueva tarea' });

  await form.getByRole('button', { name: 'Dictar la tarea' }).click();
  await expect(form.getByLabel(/^Tarea/)).toHaveValue('Comprar pan para la cena');

  // En una nota, lo dicho se añade detrás de lo escrito
  await showMoreOptions(page);
  await form.getByLabel('Notas').fill('Ojo:');
  await form.getByRole('button', { name: 'Dictar una nota' }).click();
  await expect(form.getByLabel('Notas')).toHaveValue('Ojo: Comprar pan para la cena');

  await form.getByRole('button', { name: 'Guardar la tarea' }).click();
  await expect(page.getByRole('heading', { name: 'Comprar pan para la cena' })).toBeVisible();
});

test('«Nueva tarea por voz» opens a new task with the microphone already listening', async ({ page }) => {
  await fakeSpeech(page, 'Llamar al dentista mañana');
  await page.goto('/');
  await signInWithGoogle(page);

  // Así lo abre el acceso directo del icono de la app (public/manifest.json)
  await page.goto('/?nueva=voz');
  const form = page.getByRole('dialog', { name: 'Nueva tarea' });
  await expect(form.getByLabel(/^Tarea/)).toHaveValue('Llamar al dentista mañana', { timeout: 15_000 });
  expect(await page.evaluate(() => (window as unknown as { __dictations?: number }).__dictations)).toBe(1);
  // Se quita de la dirección: recargar no lo repite
  expect(new URL(page.url()).searchParams.has('nueva')).toBe(false);

  // Cerrado (lo dictado se queda en «Borradores») y vuelto a abrir a mano, el micrófono no escucha solo
  await page.keyboard.press('Escape');
  await openSection(page, 'Listas');
  await expect(page.getByRole('button', { name: /^Borradores/ })).toBeVisible();
  await page.getByRole('button', { name: 'Nueva tarea', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Nueva tarea' }).getByLabel(/^Tarea/)).toHaveValue('');
  expect(await page.evaluate(() => (window as unknown as { __dictations?: number }).__dictations)).toBe(1);
});

test('without speech recognition in the browser there is no microphone', async ({ page }) => {
  await fakeSpeech(page, null);
  await page.goto('/');
  await signInWithGoogle(page);
  await openSection(page, 'Listas');
  await page.getByRole('button', { name: 'Añadir la primera tarea' }).click();
  await showMoreOptions(page);
  const form = page.getByRole('dialog', { name: 'Nueva tarea' });
  await expect(form.getByLabel(/^Tarea/)).toBeVisible();
  await expect(form.getByRole('button', { name: /^Dictar/ })).toHaveCount(0);
});

test('a dictation that fails says what to do, and the microphone can be tried again', async ({ page }) => {
  await fakeSpeech(page, 'error:not-allowed');
  await page.goto('/');
  await signInWithGoogle(page);
  await openSection(page, 'Listas');
  await page.getByRole('button', { name: 'Añadir la primera tarea' }).click();
  const form = page.getByRole('dialog', { name: 'Nueva tarea' });
  const mic = form.getByRole('button', { name: 'Dictar la tarea' });
  await mic.click();
  await expect(form.getByRole('alert').filter({ hasText: 'Para dictar, da permiso al micrófono' })).toBeVisible();
  await expect(mic).toHaveAttribute('aria-pressed', 'false');
  await expect(form.getByLabel(/^Tarea/)).toHaveValue('');
});

test('«Nueva tarea» opens a new task without dictating, and pending release notes wait until it closes', async ({
  page
}) => {
  await fakeSpeech(page, 'Llamar al dentista mañana');
  const email = uniqueEmail();
  await page.goto('/');
  // Una cuenta que aún no ha visto las novedades de esta versión
  await signInWithGoogle(page, email, undefined, { approve: false, onboarded: false });
  await markOnboarded(email, { releaseNotes: false });
  await approveAccess(email, { onboarded: false });

  await page.goto('/?nueva=1');
  const form = page.getByRole('dialog', { name: 'Nueva tarea' });
  await expect(form).toBeVisible({ timeout: 15_000 });
  await expect(form.getByLabel(/^Tarea/)).toHaveValue('');
  expect(await page.evaluate(() => (window as unknown as { __dictations?: number }).__dictations)).toBeUndefined();
  // Las novedades no se abren encima: esperan a que se cierre el formulario
  const notes = page.getByRole('dialog', { name: /^Novedades de la versión/ });
  await expect(notes).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(form).toHaveCount(0);
  await expect(notes).toBeVisible({ timeout: 15_000 });
});
