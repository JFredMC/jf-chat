import { expect, test, type Page } from '@playwright/test';

/**
 * Public demo (GitHub Pages): the whole app runs against the in-browser
 * backend, with simulated friends. Paths are relative to /jf-chat/.
 */

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

async function loginAsDemo(page: Page) {
  await page.goto('auth/login');
  await page.getByTestId('demo-login').click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByTestId('me-name')).toHaveText('Invitado Demo');
}

async function openChat(page: Page, name: string) {
  await page.getByTestId('conversation-item').filter({ hasText: name }).click();
  await expect(page.getByTestId('chat-title')).toHaveText(name);
}

async function backToList(page: Page) {
  const back = page.getByRole('button', { name: 'Volver a los chats' });
  if (await back.isVisible()) await back.click();
}

async function send(page: Page, text: string) {
  await page.getByTestId('composer').fill(text);
  await page.getByTestId('composer').press('Enter');
}

const lastOwnStatus = (page: Page) => page.getByTestId('message').locator('[data-status]').last();

test.beforeEach(async ({ page }) => {
  // Every test starts from the sample data.
  await page.goto('auth/login');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('the demo account has chats with history, unread messages and presence', async ({ page }) => {
  await expect(page.getByText('Modo demo:')).toBeVisible();
  await loginAsDemo(page);
  await expect(page.getByTestId('demo-banner')).toContainText('amigos son simulados');

  const laura = page.getByTestId('conversation-item').filter({ hasText: 'Laura Méndez' });
  await expect(laura.getByTestId('unread-badge')).toHaveText('2');
  await expect(page).toHaveTitle('(2) JfChat');
  await expect(laura.getByTestId('presence-dot')).toBeVisible();
  await expect(page.getByTestId('conversation-item')).toHaveCount(3);

  await openChat(page, 'Laura Méndez');
  await expect(page.getByTestId('chat-status')).toHaveText('en línea');
  await expect(page.getByTestId('message').filter({ hasText: 'Almorzamos mañana' })).toBeVisible();
  await expect(page).toHaveTitle('JfChat');
  await backToList(page);
  await expect(laura.getByTestId('unread-badge')).toHaveCount(0);
});

test('a conversation in real time: ticks, typing indicator and reply', async ({ page }) => {
  await loginAsDemo(page);
  await openChat(page, 'Laura Méndez');
  await send(page, 'Hola Laura, ¿cómo estás?');

  await expect(page.getByTestId('message').last()).toContainText('Hola Laura');
  await expect(lastOwnStatus(page)).toHaveAttribute('data-status', 'read', { timeout: 6000 });
  await expect(page.getByTestId('typing-indicator')).toContainText('Laura está escribiendo');
  await expect(page.getByTestId('message').last()).toContainText('¡Hola, Invitado!', { timeout: 8000 });
  await expect(page.getByTestId('typing-indicator')).toHaveCount(0);
});

test('offline friends receive the message later and come online to answer', async ({ page }) => {
  await loginAsDemo(page);
  await openChat(page, 'Sofía Ramírez');
  await expect(page.getByTestId('chat-status')).toContainText('visto');
  await send(page, '¿Estás ahí?');
  await expect(lastOwnStatus(page)).toHaveAttribute('data-status', 'sent');
  await expect(page.getByTestId('chat-status')).toHaveText(/en línea|escribiendo/, { timeout: 10_000 });
  await expect(page.getByTestId('message').last()).toContainText('sin señal', { timeout: 12_000 });
});

test('accepting a friend request: the new friend writes first', async ({ page }) => {
  await loginAsDemo(page);
  await page.getByTestId('tab-friends').click();
  const request = page.getByTestId('incoming-requests');
  await expect(request).toContainText('Andrés Pérez');
  await request.getByRole('button', { name: 'Aceptar' }).click();
  await expect(page.getByTestId('friends-list')).toContainText('Andrés Pérez');

  await page.getByRole('tab', { name: /Chats/ }).click();
  const andres = page.getByTestId('conversation-item').filter({ hasText: 'Andrés Pérez' });
  await expect(andres).toContainText('¡Gracias por aceptar!', { timeout: 8000 });
  await expect(andres.getByTestId('unread-badge')).toHaveText('1');
});

test('searching and adding someone: they accept on their own', async ({ page }) => {
  await loginAsDemo(page);
  await page.getByTestId('tab-friends').click();
  await page.getByTestId('user-search').fill('valen');
  const results = page.getByTestId('search-results');
  await expect(results).toContainText('Valentina Castro');
  await results.getByRole('button', { name: 'Agregar' }).click();
  await expect(page.getByText('Tienes un nuevo amigo')).toBeVisible({ timeout: 6000 });
  await expect(page.getByTestId('friends-list')).toContainText('Valentina Castro');
});

test('sending an image attachment', async ({ page }) => {
  await loginAsDemo(page);
  await openChat(page, 'Carlos Rincón');
  await page.getByTestId('file-input').setInputFiles({ name: 'captura.png', mimeType: 'image/png', buffer: PNG_1X1 });
  await expect(page.getByTestId('attachment-tray')).toContainText('captura.png');
  await expect(page.getByTestId('send')).toBeEnabled();
  await page.getByTestId('send').click();

  const sent = page.getByTestId('message').filter({ has: page.getByRole('img', { name: 'captura.png' }) });
  await expect(sent).toBeVisible();
  await expect(page.getByTestId('attachment-tray')).toHaveCount(0);
  await expect(page.getByTestId('message').last()).toContainText('¡Qué buena foto!', { timeout: 8000 });
});

test('rejects files the API would not accept', async ({ page }) => {
  await loginAsDemo(page);
  await openChat(page, 'Carlos Rincón');
  await page.getByTestId('file-input').setInputFiles({ name: 'programa.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('MZ') });
  await expect(page.getByText('solo imágenes')).toBeVisible();
  await expect(page.getByTestId('attachment-tray')).toHaveCount(0);
});

test('messages are text: markup is shown, never executed', async ({ page }) => {
  await loginAsDemo(page);
  await openChat(page, 'Carlos Rincón');
  let dialog = false;
  page.on('dialog', async (d) => {
    dialog = true;
    await d.dismiss();
  });
  await send(page, '<img src=x onerror=alert(1)> mira https://angular.dev');
  const bubble = page.getByTestId('message').filter({ hasText: '<img src=x onerror=alert(1)>' });
  await expect(bubble).toBeVisible();
  await expect(bubble.getByRole('link', { name: 'https://angular.dev' })).toHaveAttribute('rel', /noopener/);
  expect(dialog).toBe(false);
});

test('registering a new account; the session survives a reload', async ({ page }) => {
  await page.goto('auth/register');
  await page.getByLabel('Nombre').fill('Marta');
  await page.getByLabel('Usuario').fill('marta.e2e');
  await expect(page.getByText('Disponible')).toBeVisible();
  await page.getByLabel('Contraseña', { exact: true }).fill('Secreta123');
  await page.getByLabel('Repite la contraseña').fill('Secreta123');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByTestId('me-name')).toHaveText('Marta');
  await expect(page.getByTestId('tab-friends')).toContainText('1');

  await page.reload();
  await expect(page.getByTestId('me-name')).toHaveText('Marta');

  await page.goto('auth/register');
  await expect(page).toHaveURL(/\/chat$/);
});

test('validation and wrong credentials are explained in Spanish', async ({ page }) => {
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.locator('#username-error')).toBeVisible();
  await page.locator('#username').fill('demo');
  await page.locator('#password').fill('incorrecta');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('alert')).toHaveText('Usuario o contraseña incorrectos');
});

test('guards, deep links and the not-found page', async ({ page }) => {
  await page.goto('chat');
  await expect(page).toHaveURL(/\/auth\/login$/);
  await loginAsDemo(page);
  await page.goto('no-existe');
  await expect(page.getByRole('heading', { name: 'Esta página no existe' })).toBeVisible();
  await page.getByRole('link', { name: 'Volver al chat' }).click();
  await expect(page).toHaveURL(/\/chat$/);
});

test('logout, dark theme and demo reset', async ({ page }) => {
  await loginAsDemo(page);
  await page.getByRole('button', { name: 'Usar tema oscuro' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);

  await openChat(page, 'Carlos Rincón');
  await send(page, 'Mensaje que se borra al reiniciar');
  await backToList(page);
  await page.getByTestId('demo-banner').getByRole('button', { name: 'Reiniciar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reiniciar' }).click();
  await expect(page).toHaveURL(/\/auth\/login$/);
  await loginAsDemo(page);
  await expect(page.getByTestId('conversation-item').filter({ hasText: 'Carlos Rincón' })).not.toContainText('Mensaje que se borra');

  await page.getByTestId('logout').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/auth\/login$/);
  await page.goto('chat');
  await expect(page).toHaveURL(/\/auth\/login$/);
});

test('on phones the list and the chat take turns', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile layout only');
  await loginAsDemo(page);
  await openChat(page, 'Laura Méndez');
  await expect(page.getByTestId('conversation-list')).toBeHidden();
  await page.getByRole('button', { name: 'Volver a los chats' }).click();
  await expect(page.getByTestId('conversation-list')).toBeVisible();
  await expect(page.getByTestId('chat-title')).toHaveCount(0);
});
