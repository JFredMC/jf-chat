import type { AuthSession, Conversation, Friendship, Message } from '../core/models';
import type { ServerEvent } from '../core/realtime/realtime-connection';
import { DEMO_PASSWORD, STORAGE_KEY } from './demo-db';
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
    expect(error(() => login('laura.mendez'))).toMatchObject({ status: 401 });
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
    const session = call('POST', '/auth/register', { username: 'Nuevo', password: 'Secreta123', first_name: ' Ana ' }).body as AuthSession;
    expect(session.user).toMatchObject({ username: 'nuevo', first_name: 'Ana' });
    expect(call('GET', '/auth/username-available', null, null, 'username=nuevo').body).toEqual({ available: false });
    // A welcome friend request from Laura.
    const friendships = call('GET', '/friendship', null, session.accessToken).body as Friendship[];
    expect(friendships).toEqual([expect.objectContaining({ status: 'pending', direction: 'incoming' })]);
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"nuevo"');
  });

  it('lists the seeded conversations with unread counts, newest first data', () => {
    const { accessToken } = login();
    const conversations = call('GET', '/conversation', null, accessToken).body as Conversation[];
    expect(conversations).toHaveLength(3);
    const laura = conversations.find((c) => c.members.some((m) => m.user.username === 'laura.mendez'))!;
    expect(laura.unread_count).toBe(2);
    expect(laura.last_message?.content).toContain('respuestas automáticas');
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

  it('simulated friends deliver, read, type and answer over the realtime channel', async () => {
    server.speed = 0.01;
    const session = login();
    const me = session.user.id;
    const conversations = call('GET', '/conversation', null, session.accessToken).body as Conversation[];
    const laura = conversations.find((c) => c.members.some((m) => m.user.username === 'laura.mendez'))!;
    const events: ServerEvent[] = [];
    const subscription = server.eventsFor(me).subscribe((event) => events.push(event));
    server.connect(me);
    const ack = server.socket(me, 'send_message', { conversationId: laura.id, content: 'Hola Laura', client_id: 'x1' });
    expect(ack.ok).toBe(true);
    await vi.runAllTimersAsync();
    subscription.unsubscribe();
    const types = events.map((e) => e.type);
    expect(types).toEqual(
      expect.arrayContaining(['presence_snapshot', 'new_message', 'conversation_delivered', 'conversation_read', 'typing']),
    );
    const page = call('GET', `/conversation/${laura.id}/messages`, null, session.accessToken).body as { items: Message[] };
    expect(page.items.at(-1)?.content).toContain('¡Hola, Invitado!');
  });

  it('accepts friend requests on behalf of simulated people', async () => {
    server.speed = 0.01;
    const { accessToken } = login();
    const [valentina] = call('GET', '/user/search', null, accessToken, 'q=valen').body as { id: number }[];
    const request = call('POST', '/friendship/request', { friendId: valentina.id }, accessToken).body as Friendship;
    expect(request).toMatchObject({ status: 'pending', direction: 'outgoing' });
    await vi.runAllTimersAsync();
    const friendships = call('GET', '/friendship', null, accessToken).body as Friendship[];
    expect(friendships.find((f) => f.id === request.id)?.status).toBe('accepted');
    expect(error(() => call('POST', '/friendship/request', { friendId: valentina.id }, accessToken))).toMatchObject({ status: 409 });
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
