import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, firstValueFrom, of } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import type { Ack, User } from '../../core/models';
import { RealtimeConnection, type ConnectionStatus, type ServerEvent } from '../../core/realtime/realtime-connection';
import { ToastService } from '../../core/ui/toast.service';
import { message, user } from '../../testing/fixtures';
import { FriendsStore } from '../friends/friends.store';
import { ChatApi } from './chat.api';
import { ChatStore, type MessageSender } from './chat.store';
import { PresenceStore } from './presence.store';
import { RealtimeService } from './realtime.service';

class FakeConnection extends RealtimeConnection {
  public readonly state = signal<ConnectionStatus>('idle');
  public readonly status = this.state.asReadonly();
  public readonly subject = new Subject<ServerEvent>();
  public readonly events = this.subject.asObservable();
  public readonly emitted: { event: string; payload: unknown }[] = [];
  public nextAck: Ack = { ok: true };
  public connect = vi.fn(() => this.state.set('online'));
  public disconnect = vi.fn(() => this.state.set('idle'));
  public retry = vi.fn();
  public emit = vi.fn(async (event: string, payload: unknown) => {
    this.emitted.push({ event, payload });
    return this.nextAck;
  }) as RealtimeConnection['emit'];
}

describe('RealtimeService', () => {
  const me = user(1, 'ana');
  let connection: FakeConnection;
  let service: RealtimeService;
  let sender: MessageSender | null;
  const chat = {
    receive: vi.fn(),
    applyRead: vi.fn(),
    applyDelivered: vi.fn(),
    refreshConversation: vi.fn(),
    resync: vi.fn(async () => undefined),
    useSender: vi.fn((s: MessageSender | null) => (sender = s)),
    patchUser: vi.fn(),
  };
  const presence = { apply: vi.fn(), setTyping: vi.fn(), clearTyping: vi.fn() };
  const incoming = signal<unknown[]>([]);
  const friendsList = signal<unknown[]>([]);
  const friends = {
    load: vi.fn(async () => incoming.set([{}])),
    incoming,
    friends: friendsList,
    patchUser: vi.fn(),
    refreshInviteIfLoaded: vi.fn(async () => undefined),
  };
  const patchSelf = vi.fn();
  const api = { send: vi.fn() };
  const toast = { info: vi.fn(), success: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    incoming.set([]);
    friendsList.set([]);
    connection = new FakeConnection();
    TestBed.configureTestingModule({
      providers: [
        { provide: RealtimeConnection, useValue: connection },
        { provide: ChatStore, useValue: chat },
        { provide: PresenceStore, useValue: presence },
        { provide: FriendsStore, useValue: friends },
        { provide: ChatApi, useValue: api },
        { provide: ToastService, useValue: toast },
        { provide: AuthStore, useValue: { user: signal<User | null>(me), patchSelf } },
      ],
    });
    service = TestBed.inject(RealtimeService);
    service.start();
  });

  it('connects and routes messages through the socket', () => {
    expect(connection.connect).toHaveBeenCalled();
    expect(sender).toBeTypeOf('function');
  });

  it('receives messages, clears typing and confirms delivery', () => {
    const incomingMessage = message(5, 10, 2);
    connection.subject.next({ type: 'new_message', data: incomingMessage });
    expect(chat.receive).toHaveBeenCalledWith(incomingMessage);
    expect(presence.clearTyping).toHaveBeenCalledWith(10, 2);
    expect(connection.emitted).toContainEqual({ event: 'mark_delivered', payload: { conversationId: 10, messageId: 5 } });
  });

  it('does not confirm delivery of my own messages', () => {
    connection.subject.next({ type: 'new_message', data: message(6, 10, 1) });
    expect(connection.emitted).toEqual([]);
  });

  it('ignores my own typing echo', () => {
    connection.subject.next({ type: 'typing', data: { conversationId: 10, userId: 1, username: 'ana', isTyping: true } });
    connection.subject.next({ type: 'typing', data: { conversationId: 10, userId: 2, username: 'beto', isTyping: true } });
    expect(presence.setTyping).toHaveBeenCalledTimes(1);
  });

  it('applies receipts and presence', () => {
    connection.subject.next({ type: 'conversation_read', data: { conversationId: 10, userId: 2, lastReadMessageId: 5 } });
    connection.subject.next({ type: 'conversation_delivered', data: { conversationId: 10, userId: 2, lastDeliveredMessageId: 5 } });
    connection.subject.next({ type: 'presence', data: { userId: 2, online: true, lastSeen: null } });
    expect(chat.applyRead).toHaveBeenCalled();
    expect(chat.applyDelivered).toHaveBeenCalled();
    expect(presence.apply).toHaveBeenCalledWith([{ userId: 2, online: true, lastSeen: null }]);
  });

  it('applies profile updates to chats, friends and my own header', () => {
    const beto = { ...user(2, 'beto'), avatar_url: '/avatars/2/x.webp', status_message: '🎧 Ocupado' };
    connection.subject.next({ type: 'user_updated', data: beto });
    expect(chat.patchUser).toHaveBeenCalledWith(beto);
    expect(friends.patchUser).toHaveBeenCalledWith(beto);
    expect(patchSelf).not.toHaveBeenCalled();
    const self = { ...me, status_message: 'Hola' };
    connection.subject.next({ type: 'user_updated', data: self });
    expect(patchSelf).toHaveBeenCalledWith(self);
  });

  it('catches up after a reconnection, not on the first connection', () => {
    connection.subject.next({ type: 'presence_snapshot', data: [] });
    expect(chat.resync).not.toHaveBeenCalled();
    connection.subject.next({ type: 'presence_snapshot', data: [] });
    expect(chat.resync).toHaveBeenCalledTimes(1);
  });

  it('announces new friend requests', async () => {
    connection.subject.next({ type: 'friendship_updated', data: { friendshipId: 3, status: 'pending' } });
    await vi.waitFor(() => expect(toast.info).toHaveBeenCalledWith('Tienes una solicitud de contacto pendiente'));
  });

  it('tells the invite owner that someone used the code, and refreshes it', async () => {
    friends.load.mockImplementationOnce(async () => friendsList.set([{ id: 7, direction: 'outgoing' }]));
    connection.subject.next({ type: 'friendship_updated', data: { friendshipId: 7, status: 'accepted' } });
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith('Alguien usó tu código. ¡Ya pueden chatear!'));
    expect(friends.refreshInviteIfLoaded).toHaveBeenCalled();
  });

  it('does not repeat the toast for whoever redeemed the code', async () => {
    friends.load.mockImplementationOnce(async () => friendsList.set([{ id: 8, direction: 'incoming' }]));
    connection.subject.next({ type: 'friendship_updated', data: { friendshipId: 8, status: 'accepted' } });
    await vi.waitFor(() => expect(friends.load).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('sends over the socket with acknowledgement', async () => {
    const saved = message(9, 10, 1);
    connection.nextAck = { ok: true, data: saved };
    expect(await firstValueFrom(sender!(10, { content: 'hola', client_id: 'c1' }))).toEqual(saved);
    expect(connection.emitted).toContainEqual({ event: 'send_message', payload: { conversationId: 10, content: 'hola', client_id: 'c1' } });
    expect(api.send).not.toHaveBeenCalled();
  });

  it('falls back to REST when the socket cannot deliver', async () => {
    connection.nextAck = { ok: false, error: 'El servidor no respondió' };
    api.send.mockReturnValue(of(message(9, 10, 1)));
    await firstValueFrom(sender!(10, { content: 'hola', client_id: 'c1' }));
    expect(api.send).toHaveBeenCalledWith(10, { content: 'hola', client_id: 'c1' });
  });

  it('reports validation errors from the server instead of retrying', async () => {
    connection.nextAck = { ok: false, error: 'No eres miembro de esta conversación' };
    await expect(firstValueFrom(sender!(10, { content: 'hola' }))).rejects.toThrow('No eres miembro de esta conversación');
    expect(api.send).not.toHaveBeenCalled();
  });

  it('only emits typing while connected and stops cleanly', () => {
    service.typing(10, true);
    expect(connection.emitted).toContainEqual({ event: 'typing', payload: { conversationId: 10, isTyping: true } });
    service.stop();
    expect(connection.disconnect).toHaveBeenCalled();
    expect(chat.useSender).toHaveBeenLastCalledWith(null);
    service.typing(10, true);
    expect(connection.emitted.filter((e) => e.event === 'typing')).toHaveLength(1);
  });
});
