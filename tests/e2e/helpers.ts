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
