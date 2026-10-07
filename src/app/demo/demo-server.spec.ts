import type { AuthSession, Conversation, Friendship, Message } from '../core/models';
import type { ServerEvent } from '../core/realtime/realtime-connection';
import { DEMO_CODES, DEMO_PASSWORD, STORAGE_KEY } from './demo-db';
import { DemoHttpError, DemoServer } from './demo-server';

describe('DemoServer (in-browser API)', () => {
  let server: DemoServer;

  const call = (method: string, path: string, body: unknown = null, token: string | null = null, query = '') =>
    server.handle({ method, path, body, token, query: new URLSearchParams(query) });

  const login = (username = 'demo', password = DEMO_PASSWORD) => call('POST', '/auth/login', { username, password }).body as AuthSession;

  const error = (fn: () => unknown): DemoHttpError => {
    try {
      fn();
    } catch (e) {
      return e as DemoHttpError;
    }
    throw new Error('expected an error');
  };

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    server = new DemoServer();
  });

  afterEach(() => vi.useRealTimers());

  it('signs in the demo account and rejects wrong passwords and simulated people', () => {
    const session = login();
    expect(session.user.username).toBe('demo');
    expect(session.accessToken).toMatch(/^demo\.\d+\./);
    expect(error(() => login('demo', 'nope'))).toMatchObject({ status: 401, message: 'Usuario o contraseña incorrectos' });
    expect(error(() => login('luna'))).toMatchObject({ status: 401 });
  });

  it('requires a token for private endpoints', () => {
    expect(error(() => call('GET', '/conversation'))).toMatchObject({ status: 401 });
  });

  it('rotates refresh tokens: an old one stops working', () => {
    const session = login();
    const renewed = call('POST', '/auth/refresh', { refreshToken: session.refreshToken }).body as AuthSession;
    expect(renewed.refreshToken).not.toBe(session.refreshToken);
    expect(error(() => call('POST', '/auth/refresh', { refreshToken: session.refreshToken }))).toMatchObject({ status: 401 });
  });

  it('registers with the API rules and keeps the data in localStorage', () => {
    expect(error(() => call('POST', '/auth/register', { username: 'demo', password: 'Secreta123' }))).toMatchObject({ status: 409 });
    expect(error(() => call('POST', '/auth/register', { username: 'x', password: 'Secreta123' }))).toMatchObject({ status: 400 });
    expect(error(() => call('POST', '/auth/register', { username: 'nuevo', password: 'debil' }))).toMatchObject({ status: 400 });
    const session = call('POST', '/auth/register', { username: 'Nuevo', password: 'Secreta123' }).body as AuthSession;
    expect(session.user.username).toBe('nuevo');
    expect(session.user).not.toHaveProperty('first_name');
    expect(call('GET', '/auth/username-available', null, null, 'username=nuevo').body).toEqual({ available: false });
    // Nobody can find a new account: it starts without contacts.
    expect(call('GET', '/friendship', null, session.accessToken).body).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"nuevo"');
  });

  it('lists the seeded conversations with unread counts, newest first data', () => {
    const { accessToken } = login();
    const conversations = call('GET', '/conversation', null, accessToken).body as Conversation[];
    expect(conversations).toHaveLength(1);
    const luna = conversations.find((c) => c.members.some((m) => m.user.username === 'luna'))!;
    expect(luna.unread_count).toBe(2);
    expect(luna.last_message?.content).toContain('te contesto');
  });

  it('pages messages chronologically with hasMore', () => {
    const { accessToken } = login();
    const [first] = call('GET', '/conversation', null, accessToken).body as Conversation[];
    const page = call('GET', `/conversation/${first.id}/messages`, null, accessToken, 'limit=2').body as { items: Message[]; hasMore: boolean };
    expect(page.items).toHaveLength(2);
    expect(page.hasMore).toBe(true);
    expect(page.items[0].id).toBeLessThan(page.items[1].id);
  });

  it('does not let a user read conversations they are not part of', () => {
    const { accessToken } = login();
    const [conversation] = call('GET', '/conversation', null, accessToken).body as Conversation[];
    const stranger = call('POST', '/auth/register', { username: 'extrano', password: 'Secreta123' }).body as AuthSession;
    expect(error(() => call('GET', `/conversation/${conversation.id}/messages`, null, stranger.accessToken))).toMatchObject({ status: 404 });
    expect(error(() => call('POST', `/conversation/${conversation.id}/messages`, { content: 'hola' }, stranger.accessToken))).toMatchObject({ status: 404 });
  });

  it('sends idempotently by client_id and validates the content', () => {
    const { accessToken } = login();
    const [conversation] = call('GET', '/conversation', null, accessToken).body as Conversation[];
    const first = call('POST', `/conversation/${conversation.id}/messages`, { content: ' hola ', client_id: 'c-1' }, accessToken);
    const again = call('POST', `/conversation/${conversation.id}/messages`, { content: 'hola', client_id: 'c-1' }, accessToken);
    expect(first.status).toBe(201);
    expect(again.status).toBe(200);
    expect((again.body as Message).id).toBe((first.body as Message).id);
    expect((first.body as Message).content).toBe('hola');
    expect(error(() => call('POST', `/conversation/${conversation.id}/messages`, { content: '   ' }, accessToken))).toMatchObject({ status: 400 });
  });

  it('simulated contacts deliver, read, type and answer over the realtime channel', async () => {
    server.speed = 0.01;
    const session = login();
    const me = session.user.id;
    const conversations = call('GET', '/conversation', null, session.accessToken).body as Conversation[];
    const luna = conversations.find((c) => c.members.some((m) => m.user.username === 'luna'))!;
    const events: ServerEvent[] = [];
    const subscription = server.eventsFor(me).subscribe((event) => events.push(event));
    server.connect(me);
    const ack = server.socket(me, 'send_message', { conversationId: luna.id, content: 'Hola Luna', client_id: 'x1' });
    expect(ack.ok).toBe(true);
    await vi.runAllTimersAsync();
    subscription.unsubscribe();
    const types = events.map((e) => e.type);
    expect(types).toEqual(
      expect.arrayContaining(['presence_snapshot', 'new_message', 'conversation_delivered', 'conversation_read', 'typing']),
    );
    const page = call('GET', `/conversation/${luna.id}/messages`, null, session.accessToken).body as { items: Message[] };
    expect(page.items.at(-1)?.content).toContain('Hola, demo');
  });

  it('connects only through single-use invite codes (no user search)', async () => {
    server.speed = 0.01;
    const { accessToken } = login();
    expect(error(() => call('GET', '/user/search', null, accessToken, 'q=sol'))).toMatchObject({ status: 404 });
    const added = call('POST', '/friendship/invite', { code: DEMO_CODES.sol.toLowerCase() }, accessToken).body as Friendship;
    expect(added).toMatchObject({ status: 'accepted', direction: 'incoming', friend: expect.objectContaining({ username: 'sol' }) });
    expect(error(() => call('POST', '/friendship/invite', { code: DEMO_CODES.sol }, accessToken))).toMatchObject({ status: 409 });
    expect(error(() => call('POST', '/friendship/invite', { code: 'ZZZZ-ZZZZ-ZZ' }, accessToken))).toMatchObject({ status: 404 });
    // Sol says hello in a new chat.
    await vi.runAllTimersAsync();
    const conversations = call('GET', '/conversation', null, accessToken).body as Conversation[];
    expect(conversations.some((c) => c.members.some((m) => m.user.username === 'sol'))).toBe(true);

    // A person's code works once and then rotates; your own code is rejected like an unknown one.
    const { code } = call('GET', '/auth/me/invite', null, accessToken).body as { code: string };
    expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{2}$/);
    expect(error(() => call('POST', '/friendship/invite', { code }, accessToken))).toMatchObject({ status: 404 });
    const other = call('POST', '/auth/register', { username: 'otra', password: 'Secreta123' }).body as AuthSession;
    expect(error(() => call('GET', '/user/' + other.user.id, null, accessToken))).toMatchObject({ status: 404 });
    call('POST', '/friendship/invite', { code }, other.accessToken);
    // Used up: the same code no longer exists.
    expect(error(() => call('POST', '/friendship/invite', { code }, other.accessToken))).toMatchObject({ status: 404 });
    const next = call('GET', '/auth/me/invite', null, accessToken).body as { code: string };
    expect(next.code).not.toBe(code);
    expect(call('GET', '/user/' + other.user.id, null, accessToken).body).toMatchObject({ username: 'otra' });
    const rotated = call('POST', '/auth/me/invite/rotate', null, accessToken).body as { code: string };
    expect(rotated.code).not.toBe(next.code);
  });

  it('hides last seen and typing when the user asks for it', async () => {
    const session = login();
    const luna = (call('GET', '/friendship', null, session.accessToken).body as Friendship[])[0].friend;
    const lunaEvents: ServerEvent[] = [];
    const subscription = server.eventsFor(luna.id).subscribe((event) => lunaEvents.push(event));
    server.connect(session.user.id);
    const updated = call('PATCH', '/auth/me', { hide_last_seen: true, hide_typing: true }, session.accessToken).body as { hide_last_seen: boolean };
    expect(updated.hide_last_seen).toBe(true);
    const [conversation] = call('GET', '/conversation', null, session.accessToken).body as Conversation[];
    server.socket(session.user.id, 'typing', { conversationId: conversation.id, isTyping: true });
    await vi.advanceTimersByTimeAsync(0);
    subscription.unsubscribe();
    expect(lunaEvents.some((e) => e.type === 'typing')).toBe(false);
    expect(lunaEvents.filter((e) => e.type === 'presence').at(-1)).toMatchObject({ data: { online: false, lastSeen: null } });
    expect(error(() => call('PATCH', '/auth/me', { first_name: 'Ana' }, session.accessToken))).toMatchObject({ status: 400 });
  });

  it('sets a status and avatar, validates them and tells the user and contacts', async () => {
    const { accessToken, user } = login();
    const events: ServerEvent[] = [];
    const subscription = server.eventsFor(user.id).subscribe((event) => events.push(event));
    const updated = call('PATCH', '/auth/me', { status_message: '  🎧 Concentrado ' }, accessToken).body as { status_message: string };
    expect(updated.status_message).toBe('🎧 Concentrado');
    expect(error(() => call('PATCH', '/auth/me', { status_message: 'x'.repeat(141) }, accessToken))).toMatchObject({ status: 400 });

    const file = { name: 'a', type: 'image/webp', size: 10, url: 'data:image/webp;base64,AAAA', persistable: true };
    expect(server.uploadAvatar(accessToken, file).avatar_url).toBe(file.url);
    expect(() => server.uploadAvatar(accessToken, { ...file, type: 'image/gif' })).toThrow(DemoHttpError);
    expect(() => server.uploadAvatar(null, file)).toThrow(DemoHttpError);
    const friends = call('GET', '/friendship', null, accessToken).body as Friendship[];
    expect(friends.some((f) => f.friend.status_message)).toBe(true);

    const removed = call('DELETE', '/auth/me/avatar', null, accessToken).body as { avatar_url: string | null };
    expect(removed.avatar_url).toBeNull();
    await vi.runAllTimersAsync();
    subscription.unsubscribe();
    expect(events.filter((e) => e.type === 'user_updated')).toHaveLength(3);
    const cleared = call('PATCH', '/auth/me', { status_message: '' }, accessToken).body as { status_message: string | null };
    expect(cleared.status_message).toBeNull();
  });

  it('only lets members open attachments and owners discard pending ones', () => {
    const { accessToken, user } = login();
    const [conversation] = call('GET', '/conversation', null, accessToken).body as Conversation[];
    const attachment = server.upload(accessToken, conversation.id, { name: 'a.png', type: 'image/png', size: 10, url: 'data:image/png;base64,AA', persistable: true });
    expect(attachment).toMatchObject({ is_image: true, message_id: null });
    expect(call('GET', `/attachment/${attachment.id}/url`, null, accessToken).body).toMatchObject({ url: 'data:image/png;base64,AA' });
    const stranger = call('POST', '/auth/register', { username: 'otro', password: 'Secreta123' }).body as AuthSession;
    expect(error(() => call('GET', `/attachment/${attachment.id}/url`, null, stranger.accessToken))).toMatchObject({ status: 404 });
    expect(error(() => call('DELETE', `/attachment/${attachment.id}`, null, stranger.accessToken))).toMatchObject({ status: 404 });
    expect(call('DELETE', `/attachment/${attachment.id}`, null, accessToken).status).toBe(204);
    expect(user.username).toBe('demo');
  });

  it('starts over on reset', () => {
    call('POST', '/auth/register', { username: 'temporal', password: 'Secreta123' });
    server.reset();
    expect(call('GET', '/auth/username-available', null, null, 'username=temporal').body).toEqual({ available: true });
  });
});
