import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import type { Message, User } from '../../core/models';
import { ToastService } from '../../core/ui/toast.service';
import { conversation, message, user } from '../../testing/fixtures';
import { ChatApi } from './chat.api';
import { ChatStore } from './chat.store';

describe('ChatStore', () => {
  const ana = user(1, 'ana');
  const beto = user(2, 'beto');
  let store: ChatStore;
  let sent: Subject<Message>;
  const api = {
    conversations: vi.fn(),
    messages: vi.fn(),
    send: vi.fn(),
    markRead: vi.fn(),
    conversation: vi.fn(),
    openDirect: vi.fn(),
    leave: vi.fn(),
  };
  const toast = { error: vi.fn(), info: vi.fn(), success: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    sent = new Subject<Message>();
    api.conversations.mockReturnValue(
      of([
        conversation(10, [ana, beto], { last_message_at: '2026-10-01T10:00:00Z', unread_count: 2 }),
        conversation(20, [ana, user(3, 'caro')], { last_message_at: '2026-10-02T10:00:00Z' }),
      ]),
    );
    api.messages.mockReturnValue(of({ items: [message(1, 10, 2), message(2, 10, 2)], hasMore: false }));
    api.send.mockReturnValue(sent);
    api.markRead.mockReturnValue(of({ lastReadMessageId: 2 }));
    TestBed.configureTestingModule({
      providers: [
        { provide: ChatApi, useValue: api },
        { provide: ToastService, useValue: toast },
        { provide: AuthStore, useValue: { user: signal<User | null>(ana) } },
      ],
    });
    store = TestBed.inject(ChatStore);
    await store.load();
  });

  it('sorts conversations by latest activity and counts unread messages', () => {
    expect(store.conversations().map((c) => c.id)).toEqual([20, 10]);
    expect(store.totalUnread()).toBe(2);
  });

  it('opening a chat loads its messages and marks them as read', async () => {
    await store.select(10);
    expect(store.activeThread()?.messages.map((m) => m.id)).toEqual([1, 2]);
    expect(api.markRead).toHaveBeenCalledWith(10, 2);
    expect(store.active()?.unread_count).toBe(0);
    expect(store.totalUnread()).toBe(0);
  });

  it('shows a sent message immediately and reconciles it with the server copy', async () => {
    await store.select(10);
    store.send('  hola  ');
    const pending = store.activeThread()!.messages.at(-1)!;
    expect(pending).toMatchObject({ content: 'hola', pending: true });
    expect(store.deliveryState(store.active()!, pending)).toBe('sending');
    expect(api.send).toHaveBeenCalledWith(10, { client_id: pending.client_id, content: 'hola' });

    sent.next(message(3, 10, 1, { content: 'hola', client_id: pending.client_id }));
    const messages = store.activeThread()!.messages;
    expect(messages).toHaveLength(3);
    expect(messages.at(-1)).toMatchObject({ id: 3, key: pending.key });
    expect(messages.at(-1)?.pending).toBeUndefined();
    expect(store.deliveryState(store.active()!, messages.at(-1)!)).toBe('sent');
  });

  it('ignores the socket echo of a message it already has', async () => {
    await store.select(10);
    store.send('hola');
    const clientId = store.activeThread()!.messages.at(-1)!.client_id;
    const saved = message(3, 10, 1, { content: 'hola', client_id: clientId });
    store.receive(saved);
    sent.next(saved);
    expect(store.activeThread()!.messages.filter((m) => m.id === 3)).toHaveLength(1);
  });

  it('marks a failed send and retries with the same client id', async () => {
    await store.select(10);
    api.send.mockReturnValueOnce(throwError(() => new Error('offline')));
    store.send('hola');
    const failed = store.activeThread()!.messages.at(-1)!;
    expect(failed.failed).toBe(true);
    expect(store.deliveryState(store.active()!, failed)).toBe('failed');
    expect(toast.error).toHaveBeenCalled();

    store.retry(failed);
    expect(api.send).toHaveBeenLastCalledWith(10, { client_id: failed.client_id, content: 'hola' });
    expect(store.activeThread()!.messages.at(-1)?.pending).toBe(true);
  });

  it('counts unread messages for chats that are not open', async () => {
    await store.select(20);
    store.receive(message(5, 10, 2, { created_at: '2026-10-03T10:00:00Z' }));
    const chat = store.conversations().find((c) => c.id === 10)!;
    expect(chat.unread_count).toBe(3);
    expect(chat.last_message?.id).toBe(5);
    expect(store.conversations()[0].id).toBe(10);
  });

  it('moves ticks from sent to delivered to read', async () => {
    await store.select(10);
    store.receive(message(7, 10, 1));
    const mine = store.activeThread()!.messages.find((m) => m.id === 7)!;
    expect(store.deliveryState(store.active()!, mine)).toBe('sent');
    store.applyDelivered({ conversationId: 10, userId: 2, lastDeliveredMessageId: 7 });
    expect(store.deliveryState(store.active()!, mine)).toBe('delivered');
    store.applyRead({ conversationId: 10, userId: 2, lastReadMessageId: 7 });
    expect(store.deliveryState(store.active()!, mine)).toBe('read');
  });

  it('asks the server for a conversation it does not know yet', async () => {
    api.conversation.mockReturnValue(of(conversation(30, [ana, beto])));
    store.receive(message(9, 30, 2));
    await Promise.resolve();
    expect(api.conversation).toHaveBeenCalledWith(30);
    expect(store.conversations().some((c) => c.id === 30)).toBe(true);
  });

  it('catches up the open chat after a reconnection', async () => {
    await store.select(10);
    api.messages.mockReturnValue(of({ items: [message(2, 10, 2), message(3, 10, 2)], hasMore: false }));
    await store.resync();
    expect(store.activeThread()!.messages.map((m) => m.id)).toEqual([1, 2, 3]);
    expect(api.markRead).toHaveBeenLastCalledWith(10, 3);
  });

  it('starts over when it missed more than a page', async () => {
    await store.select(10);
    api.messages.mockReturnValue(of({ items: [message(50, 10, 2), message(51, 10, 2)], hasMore: true }));
    await store.resync();
    expect(store.activeThread()!.messages.map((m) => m.id)).toEqual([50, 51]);
    expect(store.activeThread()!.hasMore).toBe(true);
  });

  it('forgets everything on reset', async () => {
    await store.select(10);
    store.reset();
    expect(store.conversations()).toEqual([]);
    expect(store.activeId()).toBeNull();
  });
});
