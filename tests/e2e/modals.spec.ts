import { expect, test } from '@playwright/test';
import { signInWithGoogle } from './helpers';

// Una ventana modal más alta que la pantalla debe empezar arriba (cabecera visible) y desplazarse hacia abajo
for (const viewport of [
  { width: 1280, height: 720 },
  { width: 375, height: 667 }
]) {
  test(`the task form header is visible at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await signInWithGoogle(page);

    await page.getByRole('button', { name: 'Nueva tarea', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Nueva tarea' })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Cerrar' }).first()).toBeInViewport();

    // El final del formulario sigue siendo accesible desplazándose
    const save = page.getByRole('button', { name: 'Guardar la tarea' });
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeInViewport();
  });
}
