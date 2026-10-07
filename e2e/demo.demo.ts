import { expect, test, type Page } from '@playwright/test';

/**
 * Public demo (GitHub Pages): the whole app runs against the in-browser
 * backend, with a simulated partner. Paths are relative to /jf-chat/.
 */

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

async function loginAsDemo(page: Page) {
  await page.goto('auth/login');
  await page.getByTestId('demo-login').click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByTestId('me-name')).toHaveText('demo');
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

test('the demo account has a chat with history, unread messages and presence', async ({ page }) => {
  await expect(page.getByText('Modo demo:')).toBeVisible();
  await expect(page).toHaveTitle('Iniciar sesión · Velo');
  await loginAsDemo(page);
  await expect(page.getByTestId('demo-banner')).toContainText('pareja es simulada');

  const luna = page.getByTestId('conversation-item').filter({ hasText: 'luna' });
  await expect(luna.getByTestId('unread-badge')).toHaveText('3');
  await expect(page).toHaveTitle('(3) Velo');
  await expect(luna.getByTestId('presence-dot')).toBeVisible();
  await expect(page.getByTestId('conversation-item')).toHaveCount(1);

  await openChat(page, 'luna');
  await expect(page.getByTestId('chat-status')).toHaveText('en línea');
  await expect(page.getByTestId('message').filter({ hasText: 'abrazo largo' }).first()).toBeVisible();
  await expect(page).toHaveTitle('Velo');
  await backToList(page);
  await expect(luna.getByTestId('unread-badge')).toHaveCount(0);
});

test('a conversation in real time: ticks, typing indicator and reply', async ({ page }) => {
  await loginAsDemo(page);
  await openChat(page, 'luna');
  await send(page, 'Hola, ¿cómo va todo?');

  await expect(page.getByTestId('message').last()).toContainText('¿cómo va todo?');
  await expect(lastOwnStatus(page)).toHaveAttribute('data-status', 'read', { timeout: 6000 });
  await expect(page.getByTestId('typing-indicator')).toContainText('luna está escribiendo');
  await expect(page.getByTestId('message').last()).toContainText('Hola, demo', { timeout: 8000 });
  await expect(page.getByTestId('typing-indicator')).toHaveCount(0);
});

test('contacts only through invite codes: no search, redeem a code and the contact writes first', async ({ page }) => {
  await loginAsDemo(page);
  await page.getByTestId('tab-friends').click();
  await expect(page.getByTestId('user-search')).toHaveCount(0);

  // My own code is hidden until I reveal it.
  const panel = page.locator('#panel-friends');
  const mine = panel.getByTestId('my-invite');
  await expect(mine.getByTestId('invite-code')).toHaveText('••••-••••-••');
  await mine.getByTestId('invite-reveal').click();
  await expect(mine.getByTestId('invite-code')).toHaveText(/^\s*[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{2}\s*$/);
  const before = await mine.getByTestId('invite-code').textContent();
  await mine.getByTestId('invite-rotate').click();
  await expect(page.getByText('Código nuevo')).toBeVisible();
  await expect(mine.getByTestId('invite-code')).not.toHaveText(before!);

  const redeem = panel.getByTestId('redeem-invite');
  await redeem.getByTestId('redeem-input').fill('zzzzzzzzzz');
  await expect(redeem.getByTestId('redeem-input')).toHaveValue('ZZZZ-ZZZZ-ZZ');
  await redeem.getByTestId('redeem-submit').click();
  await expect(page.getByText('Código de invitación inválido o ya usado')).toBeVisible();

  const code = await page.getByTestId('demo-code').textContent();
  await redeem.getByTestId('redeem-input').fill(code!.toLowerCase());
  await redeem.getByTestId('redeem-submit').click();
  await expect(page.getByText('sol ya es tu contacto')).toBeVisible();
  // Sol hides their last seen: no presence, ever.
  await expect(page.getByTestId('chat-title')).toHaveText('sol');
  await expect(page.getByTestId('message').last()).toContainText('Usaste mi código', { timeout: 8000 });
  await expect(page.getByTestId('chat-status')).toHaveText('última conexión oculta');
});

test('Mi perfil: photo with preview, personal status and back to initials', async ({ page }) => {
  await loginAsDemo(page);
  await page.getByTestId('open-profile').click();
  const dialog = page.getByRole('dialog', { name: 'Mi perfil' });
  await expect(dialog).toBeVisible();

  await dialog.getByTestId('avatar-input').setInputFiles({ name: 'doc.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
  await expect(dialog.getByTestId('avatar-error')).toContainText('JPG, PNG o WebP');

  await dialog.getByTestId('avatar-input').setInputFiles({ name: 'yo.png', mimeType: 'image/png', buffer: PNG_1X1 });
  await expect(dialog.getByTestId('avatar-preview')).toBeVisible();
  await dialog.getByTestId('avatar-save').click();
  await expect(page.getByText('Foto de perfil actualizada')).toBeVisible();
  await expect(dialog.getByTestId('avatar-remove')).toBeVisible();

  await dialog.getByRole('button', { name: 'Agregar 🎧' }).click();
  await dialog.getByTestId('status-input').fill('🎧 Probando la demo');
  await dialog.getByTestId('status-save').click();
  await expect(page.getByText('Estado actualizado')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cerrar' }).click();

  await expect(page.getByTestId('me-status')).toHaveText('🎧 Probando la demo');
  await expect(page.locator('aside header').getByTestId('avatar-img')).toBeVisible();
  // Contacts show their status in the list.
  await expect(page.getByTestId('conversation-item').filter({ hasText: 'luna' }).getByTestId('conversation-status-message')).toContainText('Solo para ti');

  await page.getByTestId('open-profile').click();
  await dialog.getByTestId('avatar-remove').click();
  await expect(page.getByText('Foto eliminada')).toBeVisible();
  await dialog.getByTestId('status-clear').click();
  await expect(page.getByText('Estado borrado')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.locator('aside header').getByTestId('avatar-img')).toHaveCount(0);
  await expect(page.getByTestId('me-status')).toHaveText('@demo');
});

test('privacy toggles: hide last seen and typing, discreet mode renames the app', async ({ page }) => {
  await loginAsDemo(page);
  await page.getByTestId('open-profile').click();
  const dialog = page.getByRole('dialog', { name: 'Mi perfil' });
  await expect(dialog.getByLabel('Nombre')).toHaveCount(0);
  await dialog.getByTestId('hide-last-seen').check();
  await expect(page.getByText('Privacidad actualizada')).toBeVisible();
  await dialog.getByTestId('hide-typing').check();
  // The demo answers with a simulated network delay: wait until it is stored.
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('velo.demo.db')!).users[0].hide_typing)).toBe(true);
  await dialog.getByTestId('disguise').check();
  await expect(page).toHaveTitle('Notas');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', 'manifest-discreto.webmanifest');
  await dialog.getByRole('button', { name: 'Cerrar' }).click();

  // Survives a reload (applied before the first paint by boot.js) and hides the unread count.
  await page.reload();
  await expect(page).toHaveTitle('Notas');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', 'icons/notas.ico');
  await page.getByTestId('open-profile').click();
  await expect(dialog.getByTestId('hide-last-seen')).toBeChecked();
  await expect(dialog.getByTestId('hide-typing')).toBeChecked();
  await dialog.getByTestId('disguise').uncheck();
  await expect(page).toHaveTitle(/Velo$/);
});

test('the "Nuevo chat" button opens a chat with a contact or connects with a code', async ({ page }) => {
  await loginAsDemo(page);
  const fab = page.getByRole('button', { name: 'Nuevo chat' });
  await expect(fab).toBeVisible();
  // Bottom right of the list, inside the viewport (nothing else down there to cover).
  const box = (await fab.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);

  await fab.click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo chat' });
  await expect(dialog.getByTestId('new-chat-friends')).toContainText('luna');
  await expect(dialog.getByTestId('redeem-invite')).toBeVisible();
  await expect(dialog.getByTestId('my-invite')).toBeVisible();
  await dialog.getByRole('button', { name: 'Chatear con luna' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('chat-title')).toHaveText('luna');
  await expect(page.getByTestId('chat-status-message')).toContainText('Solo para ti');
});

test('sending an image attachment', async ({ page }) => {
  await loginAsDemo(page);
  await openChat(page, 'luna');
  await page.getByTestId('file-input').setInputFiles({ name: 'captura.png', mimeType: 'image/png', buffer: PNG_1X1 });
  await expect(page.getByTestId('attachment-tray')).toContainText('captura.png');
  await expect(page.getByTestId('send')).toBeEnabled();
  await page.getByTestId('send').click();

  // Never shown inline: a tile that has to be held.
  const sent = page.locator('[data-mine="true"]').filter({ has: page.getByTestId('secure-media') }).last();
  await expect(sent).toBeVisible();
  await expect(sent.locator('img')).toHaveCount(0);
  await expect(page.getByTestId('attachment-tray')).toHaveCount(0);
  await expect(page.getByTestId('message').last()).toContainText('Ya la vi', { timeout: 8000 });
});

test('rejects files the API would not accept', async ({ page }) => {
  await loginAsDemo(page);
  await openChat(page, 'luna');
  await page.getByTestId('file-input').setInputFiles({ name: 'programa.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('MZ') });
  await expect(page.getByText('solo fotos').first()).toBeVisible();
  await page.getByTestId('file-input').setInputFiles({ name: 'contrato.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
  await expect(page.getByText('«contrato.pdf»: solo fotos')).toBeVisible();
  await expect(page.getByTestId('attachment-tray')).toHaveCount(0);
});

test('messages are text: markup is shown, never executed', async ({ page }) => {
  await loginAsDemo(page);
  await openChat(page, 'luna');
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

test('registering asks only for a username and a password; the session survives a reload', async ({ page }) => {
  await page.goto('auth/register');
  await expect(page.getByLabel('Nombre')).toHaveCount(0);
  await expect(page.getByLabel(/correo/i)).toHaveCount(0);
  await page.getByLabel('Usuario').fill('marta.e2e');
  await expect(page.getByText('Disponible')).toBeVisible();
  await page.getByLabel('Contraseña', { exact: true }).fill('Secreta123');
  await page.getByLabel('Repite la contraseña').fill('Secreta123');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByTestId('me-name')).toHaveText('marta.e2e');
  await expect(page.getByTestId('conversation-item')).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId('me-name')).toHaveText('marta.e2e');
  // The refresh token lives under the Velo key, nothing under the old one.
  expect(await page.evaluate(() => [!!localStorage.getItem('velo.session'), localStorage.getItem('jfchat.refresh')])).toEqual([true, null]);

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

test('logout, dark theme by default and demo reset', async ({ page }) => {
  await loginAsDemo(page);
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Usar tema claro' }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).not.toHaveClass(/dark/);

  await openChat(page, 'luna');
  await send(page, 'Mensaje que se borra al reiniciar');
  await backToList(page);
  await page.getByTestId('demo-banner').getByRole('button', { name: 'Reiniciar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reiniciar' }).click();
  await expect(page).toHaveURL(/\/auth\/login$/);
  await loginAsDemo(page);
  await expect(page.getByTestId('conversation-item').filter({ hasText: 'luna' })).not.toContainText('Mensaje que se borra');

  await page.getByTestId('logout').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/auth\/login$/);
  await page.goto('chat');
  await expect(page).toHaveURL(/\/auth\/login$/);
});

test('on phones the list and the chat take turns', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile layout only');
  await loginAsDemo(page);
  await openChat(page, 'luna');
  await expect(page.getByTestId('conversation-list')).toBeHidden();
  await page.getByRole('button', { name: 'Volver a los chats' }).click();
  await expect(page.getByTestId('conversation-list')).toBeVisible();
  await expect(page.getByTestId('chat-title')).toHaveCount(0);
});

test('the "por JFredDev" mark opens the portfolio in a new tab', async ({ page }) => {
  const mark = page.getByRole('link', { name: /por JFredDev/ });
  await expect(mark).toHaveAttribute('href', 'https://jfredmc.github.io/portfolio/');
  await expect(mark).toHaveAttribute('target', '_blank');
  await expect(mark).toHaveAttribute('rel', /noopener/);
});

test('a strict CSP is in place and nothing breaks under it', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
  });
  await loginAsDemo(page);
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("script-src 'self'");
  expect(csp).toContain("object-src 'none'");
  expect(violations).toEqual([]);
});

test('bubbles: grouped with a tail on the last one, quotes and a live countdown', async ({ page }) => {
  await loginAsDemo(page);
  await openChat(page, 'luna');
  await expect(page.getByTestId('retention-note')).toContainText('24 horas');
  const quote = page.getByTestId('message').filter({ hasText: 'Lo cobro' }).getByTestId('reply-quote');
  await expect(quote).toContainText('abrazo largo');
  const ephemeral = page.getByTestId('message').filter({ hasText: 'Y este, en una hora' });
  await expect(ephemeral.getByTestId('countdown')).toHaveText(/⏱ \d{1,2}:\d{2}/);
  const before = await ephemeral.getByTestId('countdown').textContent();
  await expect(ephemeral.getByTestId('countdown')).not.toHaveText(before!, { timeout: 3000 });
  // Three in a row from luna: only the last one has the tail.
  const run = page.getByTestId('message').filter({ hasText: /Recuerda|Y este|Escríbeme/ });
  await expect(run).toHaveCount(3);
  await expect(run.nth(0)).not.toHaveClass(/bubble-tail-theirs/);
  await expect(run.nth(2)).toHaveClass(/bubble-tail-theirs/);
});

test('reply by quoting, with emojis from the picker', async ({ page, isMobile }) => {
  await loginAsDemo(page);
  await openChat(page, 'luna');
  const target = page.getByTestId('message').filter({ hasText: 'Escríbeme algo' });
  if (isMobile) await target.dblclick();
  else {
    await target.hover();
    await page.getByTestId('message-list').getByRole('button', { name: 'Responder' }).last().click();
  }
  await expect(page.getByTestId('reply-preview')).toContainText('Respondiendo a luna');
  await expect(page.getByTestId('reply-preview')).toContainText('Escríbeme algo');

  await page.getByTestId('composer').fill('Aquí estoy ');
  await page.getByTestId('emoji-toggle').click();
  await page.getByTestId('emoji-picker').getByRole('tab', { name: 'Amor' }).click();
  await page.getByTestId('emoji-picker').getByRole('button', { name: '💜' }).click();
  await expect(page.getByTestId('composer')).toHaveValue('Aquí estoy 💜');
  await page.getByTestId('composer').press('Enter');

  const sent = page.getByTestId('message').filter({ hasText: 'Aquí estoy 💜' });
  await expect(sent.getByTestId('reply-quote')).toContainText('Escríbeme algo');
  await expect(page.getByTestId('reply-preview')).toHaveCount(0);
  // Tapping the quote jumps to the original.
  await sent.getByTestId('reply-quote').click();
  await expect(page.locator('.flash')).toHaveCount(1);
});

test('ephemeral and view-once messages disappear for both', async ({ page }) => {
  await loginAsDemo(page);
  await openChat(page, 'luna');
  await page.getByTestId('ephemeral-toggle').click();
  await page.getByTestId('ephemeral-menu').getByRole('menuitemradio', { name: '1 minuto' }).click();
  await expect(page.getByTestId('ephemeral-hint')).toContainText('1 minuto');
  await send(page, 'Esto dura un minuto');
  await expect(page.getByTestId('message').filter({ hasText: 'Esto dura un minuto' }).getByTestId('countdown')).toHaveText(/⏱ 0:5\d|⏱ 1:00/);

  await page.getByTestId('ephemeral-toggle').click();
  await page.getByTestId('view-once').click();
  await expect(page.getByTestId('ephemeral-hint')).toContainText('Ver una vez');
  await send(page, 'Solo una vez');
  const once = page.getByTestId('message').filter({ hasText: 'Solo una vez' });
  await expect(once).toBeVisible();
  // Luna opens it: 30 s later it self-destructs on both sides.
  await expect(once.getByTestId('countdown')).toBeVisible({ timeout: 8000 });
  await expect(once).toHaveCount(0, { timeout: 40_000 });
});

test('the partner profile opens from the header; «Autodestruir» asks first and wipes the chat', async ({ page }) => {
  await loginAsDemo(page);
  await openChat(page, 'luna');
  await page.getByTestId('open-partner').click();
  const profile = page.getByTestId('partner-profile');
  await expect(profile.getByRole('heading', { name: 'luna' })).toBeVisible();
  await expect(profile.getByTestId('partner-status')).toContainText('Solo para ti');
  await expect(profile).toContainText('24 h');
  await profile.getByTestId('partner-destroy').click();

  const confirm = page.getByRole('dialog', { name: '¿Autodestruir este chat?' });
  await expect(confirm).toContainText('No se puede deshacer');
  await confirm.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByTestId('chat-title')).toHaveText('luna');

  await page.getByTestId('destroy-chat').click();
  await page.getByRole('dialog', { name: '¿Autodestruir este chat?' }).getByRole('button', { name: 'Autodestruir' }).click();
  await expect(page.getByTestId('conversation-item')).toHaveCount(0);
  await expect(page.getByTestId('chat-title')).toHaveCount(0);
  // Still a contact: a new, empty chat can start.
  await page.getByTestId('tab-friends').click();
  await page.getByRole('button', { name: 'Chatear con luna' }).click();
  await expect(page.getByTestId('message')).toHaveCount(0);
});

test('photos are only visible while held: canvas with a watermark, nothing to save', async ({ page }) => {
  await loginAsDemo(page);
  await openChat(page, 'luna');
  const tile = page.getByTestId('secure-media').first();
  await expect(tile).toContainText('Mantén pulsado para ver');
  await expect(page.locator('img[src*="demo-foto"]')).toHaveCount(0);

  await tile.scrollIntoViewIfNeeded();
  const box = (await tile.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const viewer = page.getByTestId('media-viewer');
  await expect(viewer).toBeVisible();
  const canvas = page.getByTestId('media-canvas');
  await expect.poll(() => canvas.evaluate((c: HTMLCanvasElement) => c.width)).toBeGreaterThan(100);
  // The watermark is drawn into the pixels themselves: compare with the bare photo.
  const changed = await canvas.evaluate(async (c: HTMLCanvasElement) => {
    const bare = new Image();
    bare.src = 'images/demo-foto.webp';
    await bare.decode();
    const ref = document.createElement('canvas');
    ref.width = c.width;
    ref.height = c.height;
    const refCtx = ref.getContext('2d')!;
    refCtx.drawImage(bare, 0, 0, c.width, c.height);
    const a = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    const b = refCtx.getImageData(0, 0, c.width, c.height).data;
    let count = 0;
    for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 25) count++;
    return count / (a.length / 4);
  });
  expect(changed).toBeGreaterThan(0.01);
  // No context menu, no dragging.
  expect(await canvas.evaluate((c) => c.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })))).toBe(false);
  await expect(viewer.locator('img, a[href]')).toHaveCount(0);

  await page.mouse.up();
  await expect(viewer).toHaveCount(0);
});

test('screenshot deterrence: the chat hides on blur, PrintScreen and print', async ({ page }) => {
  await loginAsDemo(page);
  await openChat(page, 'luna');
  const shield = page.getByTestId('privacy-shield');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(shield).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(shield).toBeHidden();

  await page.keyboard.press('PrintScreen');
  await expect(shield).toBeVisible();
  await expect(shield).toBeHidden({ timeout: 6000 });

  await page.keyboard.press('Control+p');
  await expect(page.getByText('Imprimir está desactivado en Velo')).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('app-root')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
  await expect(page.locator('app-root')).toBeVisible();
});

test('PIN lock: sealed session, asks on open and on demand, wrong PINs are counted', async ({ page }) => {
  await loginAsDemo(page);
  await page.getByTestId('open-profile').click();
  const dialog = page.getByRole('dialog', { name: 'Mi perfil' });
  await dialog.getByTestId('pin-new').fill('4821');
  await dialog.getByTestId('pin-confirm').fill('4821');
  await dialog.getByTestId('pin-save').click();
  await expect(page.getByText('PIN activado')).toBeVisible();
  await expect(dialog.getByTestId('pin-remove')).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem('velo.session'));
  expect(stored?.startsWith('pin1.')).toBe(true);
  await dialog.getByRole('button', { name: 'Cerrar' }).click();

  await page.reload();
  const lock = page.getByTestId('lock-screen');
  await expect(lock).toBeVisible();
  await lock.getByTestId('lock-pin').fill('0000');
  await lock.getByTestId('lock-submit').click();
  await expect(lock.getByTestId('lock-error')).toContainText('Quedan 4 intentos');
  await lock.getByTestId('lock-pin').fill('4821');
  await lock.getByTestId('lock-submit').click();
  await expect(lock).toBeHidden();
  await expect(page.getByTestId('me-name')).toHaveText('demo');

  await page.getByTestId('lock-now').click();
  await expect(lock).toBeVisible();
  await lock.getByTestId('lock-pin').fill('4821');
  await lock.getByTestId('lock-pin').press('Enter');
  await expect(lock).toBeHidden();

  await page.getByTestId('open-profile').click();
  await dialog.getByTestId('pin-current').fill('4821');
  await dialog.getByTestId('pin-remove').click();
  await expect(page.getByText('PIN quitado')).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('velo.session')?.startsWith('pin1.'))).toBe(false);
});

test('panic button: signs out and wipes this device at once', async ({ page }) => {
  await loginAsDemo(page);
  await page.getByTestId('open-profile').click();
  await page.getByTestId('disguise').check();
  await page.getByRole('dialog', { name: 'Mi perfil' }).getByRole('button', { name: 'Cerrar' }).click();
  await openChat(page, 'luna');
  await send(page, 'Secreto antes del pánico');
  await expect(page.getByTestId('message').filter({ hasText: 'Secreto antes del pánico' })).toBeVisible();
  await backToList(page);
  await page.getByTestId('panic').click();
  await expect(page).toHaveURL(/\/auth\/login$/);
  // Only the discreet preferences survive (the demo re-seeds its sample data).
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter((k) => !['velo.disguise', 'velo.theme', 'velo.demo.db'].includes(k)))).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('velo.demo.db') ?? '')).not.toContain('Secreto antes del pánico');
  // Still discreet after the wipe.
  await expect(page).toHaveTitle(/Notas/);

  // Escape three times does the same.
  await loginAsDemo(page);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/auth\/login$/);
});

test('content-free notifications: preview with only a code; the demo sends none', async ({ page }) => {
  await loginAsDemo(page);
  await page.getByTestId('open-profile').click();
  const dialog = page.getByRole('dialog', { name: 'Mi perfil' });
  await expect(dialog.getByTestId('push-preview')).toContainText(/^\s*\d{6}\s*Así se ve un aviso\s*$/);
  await dialog.getByTestId('push-toggle').click();
  await expect(dialog.getByTestId('push-hint')).toContainText('en la demo no se envían');
  await expect(dialog.getByTestId('push-toggle')).not.toBeChecked();
});
