import { expect, test as setup } from '@playwright/test';
import { callFunction } from './helpers';

// Arranque en frío: la primera carga compila la app (Vite) y la primera llamada a cada emulador lo despierta. Se hace
// aquí, una vez, con tiempo de sobra, para que no se lo coma la primera prueba de cada proceso.
setup('warm up the app and the emulators', async ({ page }) => {
  setup.setTimeout(180_000);
  await page.goto('/');
  const signIn = page.getByRole('button', { name: 'Continuar con Google' });
  await expect(signIn).toBeVisible({ timeout: 120_000 });
  // La ventana de Google del emulador de Auth
  const popupPromise = page.waitForEvent('popup', { timeout: 60_000 });
  await signIn.click();
  const popup = await popupPromise;
  await popup.waitForLoadState('load');
  await popup.close();
  // Functions (sin sesión responde 401, pero ya está cargado) y Firestore
  await callFunction('syncAccess', 'warm-up', {});
  await fetch('http://127.0.0.1:8281/');
});
