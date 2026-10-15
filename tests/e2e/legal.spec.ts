import { expect, test } from '@playwright/test';
import { signInWithGoogle } from './helpers';

test('the legal pages are public and link to each other', async ({ page }) => {
  await page.goto('/privacidad');
  await expect(page).toHaveTitle('Política de privacidad · CLAR');
  await expect(page.getByRole('heading', { level: 1, name: 'Política de privacidad' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'info@clar.life' }).first()).toHaveAttribute(
    'href',
    'mailto:info@clar.life'
  );
  const nav = page.getByRole('navigation', { name: 'Textos legales' });
  await expect(nav.getByRole('link', { name: 'Política de privacidad' })).toHaveAttribute('aria-current', 'page');

  await nav.getByRole('link', { name: 'Condiciones de uso' }).click();
  await expect(page).toHaveURL(/\/condiciones$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Condiciones de uso' })).toBeVisible();
  await nav.getByRole('link', { name: 'Aviso legal' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Aviso legal' })).toBeVisible();

  // Con barra final también, y «Volver a CLAR» lleva a la app
  await page.goto('/privacidad/');
  await expect(page.getByRole('heading', { level: 1, name: 'Política de privacidad' })).toBeVisible();
  await page.getByRole('link', { name: 'Volver a CLAR' }).click();
  await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeVisible();
});

test('signing in means accepting the terms, and the app links to the legal pages', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/confirmas que tienes al menos 14 años/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'condiciones de uso', exact: true })).toHaveAttribute(
    'href',
    '/condiciones'
  );
  await expect(page.getByRole('link', { name: 'política de privacidad', exact: true })).toHaveAttribute(
    'href',
    '/privacidad'
  );

  // Dentro de la app, en el pie, se abren en otra pestaña
  await signInWithGoogle(page);
  const footer = page.getByRole('contentinfo').getByRole('navigation', { name: 'Textos legales' });
  const privacy = footer.getByRole('link', { name: /^Política de privacidad/ });
  await expect(privacy).toHaveAttribute('target', '_blank');
  const [policy] = await Promise.all([page.context().waitForEvent('page'), privacy.click()]);
  await expect(policy.getByRole('heading', { level: 1, name: 'Política de privacidad' })).toBeVisible();
});
