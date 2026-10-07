import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { errorMessage } from '../../core/api-error';
import { AuthStore } from '../../core/auth/auth.store';
import type { Attachment, Conversation, ConversationMember, DeliveredEvent, Message, ReadEvent, User } from '../../core/models';
import { ToastService } from '../../core/ui/toast.service';
import { ChatApi, type SendMessageBody } from './chat.api';
import { newClientId } from './client-id';

export type DeliveryState = 'sending' | 'failed' | 'sent' | 'delivered' | 'read';

/** A message as the UI sees it: server messages plus optimistic ones. */
export interface UiMessage extends Message {
  /** Stable key for @for: the client_id while sending, then the server id. */
  key: string;
  pending?: boolean;
  failed?: boolean;
}

export interface Thread {
  messages: UiMessage[];
  hasMore: boolean;
  loading: boolean;
  loaded: boolean;
  error: string | null;
}

const PAGE_SIZE = 30;
/** Default rolling retention of the API (MESSAGE_RETENTION). */
export const DEFAULT_RETENTION_SECONDS = 24 * 60 * 60;

/** How the next message in a chat is sent. */
export interface SendOptions {
  /** Ephemeral: seconds until it self-destructs (null = the normal 24 h). */
  expiresIn: number | null;
  /** Disappears 30 s after the other person opens it. */
  viewOnce: boolean;
}

export const NO_OPTIONS: SendOptions = { expiresIn: null, viewOnce: false };

/** Deadline of a message: its own expiry or the chat's retention, whichever comes first. */
export function deadlineOf(message: Pick<Message, 'created_at' | 'expires_at'>, retentionSeconds = DEFAULT_RETENTION_SECONDS): number {
  const retention = new Date(message.created_at).getTime() + retentionSeconds * 1000;
  const own = message.expires_at ? new Date(message.expires_at).getTime() : Infinity;
  return Math.min(retention, own);
}
const emptyThread = (): Thread => ({ messages: [], hasMore: false, loading: false, loaded: false, error: null });
const toUi = (message: Message): UiMessage => ({ ...message, key: message.client_id ?? `m${message.id}` });

const activityOf = (conversation: Conversation): number =>
  new Date(conversation.last_message?.created_at ?? conversation.last_message_at ?? 0).getTime();

/** Sends a message; replaced by the realtime transport when the socket is up. */
export type MessageSender = (conversationId: number, body: SendMessageBody) => Observable<Message>;

/**
 * Chat state with signals: conversation list, message threads (paginated,
 * with optimistic sends) and read/delivery pointers.
 */
@Injectable({ providedIn: 'root' })
export class ChatStore {
  private readonly api = inject(ChatApi);
  private readonly auth = inject(AuthStore);
  private readonly toast = inject(ToastService);

  private readonly conversationsState = signal<Conversation[]>([]);
  private readonly threadsState = signal<Record<number, Thread>>({});
  private readonly replyState = signal<Record<number, UiMessage | null>>({});
  private readonly optionsState = signal<Record<number, SendOptions>>({});
  private sender: MessageSender = (id, body) => this.api.send(id, body);

  public readonly loading = signal(false);
  public readonly loaded = signal(false);
  /** Ticks every second while the chat is open: countdowns and on-time pruning. */
  public readonly now = signal(Date.now());
  public readonly activeId = signal<number | null>(null);

  public readonly conversations = computed(() =>
    [...this.conversationsState()].sort((a, b) => activityOf(b) - activityOf(a)),
  );
  public readonly active = computed(() => this.conversationsState().find((c) => c.id === this.activeId()) ?? null);
  public readonly activeThread = computed(() => {
    const id = this.activeId();
    return id === null ? null : (this.threadsState()[id] ?? emptyThread());
  });
  /** Message being quoted in the open chat's composer. */
  public readonly replyingTo = computed(() => {
    const id = this.activeId();
    return id === null ? null : (this.replyState()[id] ?? null);
  });
  /** Ephemeral / view-once settings of the open chat (memory only, never stored). */
  public readonly sendOptions = computed(() => {
    const id = this.activeId();
    return id === null ? NO_OPTIONS : (this.optionsState()[id] ?? NO_OPTIONS);
  });
  public readonly totalUnread = computed(() => this.conversationsState().reduce((sum, c) => sum + (c.unread_count || 0), 0));

  public me(): User | null {
    return this.auth.user();
  }

  public useSender(sender: MessageSender | null): void {
    this.sender = sender ?? ((id, body) => this.api.send(id, body));
  }

  // --- Conversations --------------------------------------------------------

  public async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.conversationsState.set(await firstValueFrom(this.api.conversations()));
      this.loaded.set(true);
    } catch (error) {
      this.toast.error(errorMessage(error, 'No se pudieron cargar tus conversaciones'));
    } finally {
      this.loading.set(false);
    }
  }

  public async select(id: number | null): Promise<void> {
    this.activeId.set(id);
    if (id === null) return;
    const thread = this.threadsState()[id];
    if (!thread?.loaded && !thread?.loading) await this.loadPage(id);
    this.markActiveRead();
  }

  /** Opens (or reuses) the direct chat with a friend and selects it. */
  public async openWith(friendId: number): Promise<void> {
    try {
      const conversation = await firstValueFrom(this.api.openDirect(friendId));
      this.upsert(conversation);
      await this.select(conversation.id);
    } catch (error) {
      this.toast.error(errorMessage(error, 'No se pudo abrir el chat'));
    }
  }

  /** «Autodestruir»: the chat, its messages and files disappear for both. */
  public async destroy(id: number): Promise<boolean> {
    try {
      await firstValueFrom(this.api.destroy(id));
      this.forget(id);
      return true;
    } catch (error) {
      this.toast.error(errorMessage(error, 'No se pudo autodestruir el chat'));
      return false;
    }
  }

  /** The other person destroyed the chat (realtime `conversation_destroyed`). */
  public applyDestroyed(id: number): void {
    const known = this.conversationsState().some((c) => c.id === id);
    this.forget(id);
    if (known) this.toast.info('El chat se autodestruyó. No queda nada.');
  }

  /** The server destroyed messages (expired or older than the retention). */
  public applyDeleted(conversationId: number, ids: number[]): void {
    const gone = new Set(ids);
    this.removeWhere(conversationId, (m) => !m.pending && !m.failed && gone.has(m.id));
  }

  /** View-once messages got a deadline once opened. */
  public applyExpiring(conversationId: number, items: { id: number; expires_at: string }[]): void {
    const deadlines = new Map(items.map((item) => [item.id, item.expires_at]));
    this.patchThread(conversationId, (thread) => ({
      ...thread,
      messages: thread.messages.map((m) => (deadlines.has(m.id) ? { ...m, expires_at: deadlines.get(m.id)! } : m)),
    }));
  }

  /**
   * Drops what is past its deadline right away, without waiting for the
   * server's purge (it runs every few seconds and confirms with messages_deleted).
   */
  public pruneExpired(now = Date.now()): void {
    for (const conversation of this.conversationsState()) {
      const retention = conversation.retention_seconds ?? DEFAULT_RETENTION_SECONDS;
      const expired = (m: Message) => deadlineOf(m, retention) <= now;
      const thread = this.threadsState()[conversation.id];
      if (thread?.messages.some((m) => !m.pending && !m.failed && expired(m))) {
        this.removeWhere(conversation.id, (m) => !m.pending && !m.failed && expired(m));
      } else if (conversation.last_message && expired(conversation.last_message)) {
        this.patchConversation(conversation.id, (c) => ({ ...c, last_message: null }));
      }
    }
  }

  public tick(now = Date.now()): void {
    this.now.set(now);
    this.pruneExpired(now);
  }

  public reply(message: UiMessage | null): void {
    const id = this.activeId();
    if (id === null) return;
    this.replyState.update((state) => ({ ...state, [id]: message }));
  }

  public setOptions(changes: Partial<SendOptions>): void {
    const id = this.activeId();
    if (id === null) return;
    this.optionsState.update((state) => ({ ...state, [id]: { ...(state[id] ?? NO_OPTIONS), ...changes } }));
  }

  public async leave(id: number): Promise<void> {
    try {
      await firstValueFrom(this.api.leave(id));
      this.conversationsState.update((list) => list.filter((c) => c.id !== id));
      if (this.activeId() === id) this.activeId.set(null);
    } catch (error) {
      this.toast.error(errorMessage(error, 'No se pudo eliminar el chat'));
    }
  }

  /** Refreshes one conversation (e.g. a chat that reappeared). */
  public async refreshConversation(id: number): Promise<void> {
    try {
      this.upsert(await firstValueFrom(this.api.conversation(id)));
    } catch {
      /* not a member any more */
    }
  }

  /** A user changed their photo, name or status (realtime `user_updated`). */
  public patchUser(user: User): void {
    this.conversationsState.update((list) =>
      list.map((c) =>
        c.members.some((m) => m.user_id === user.id)
          ? { ...c, members: c.members.map((m) => (m.user_id === user.id ? { ...m, user: { ...m.user, ...user } } : m)) }
          : c,
      ),
    );
  }

  public otherMember(conversation: Conversation | null): ConversationMember | null {
    if (!conversation) return null;
    const me = this.me()?.id;
    return conversation.members.find((member) => member.user_id !== me) ?? null;
  }

  /** After a reconnection: refresh the list and catch up the open chat. */
  public async resync(): Promise<void> {
    await this.load();
    const id = this.activeId();
    // Other threads may have missed messages: they reload when opened again.
    this.threadsState.update((threads) => (id !== null && threads[id] ? { [id]: threads[id] } : {}));
    if (id === null || !this.threadsState()[id]?.loaded) return;
    try {
      const page = await firstValueFrom(this.api.messages(id, undefined, PAGE_SIZE));
      const thread = this.threadsState()[id];
      const newestKnown = Math.max(0, ...thread.messages.filter((m) => !m.pending && !m.failed).map((m) => m.id));
      if (page.hasMore && (page.items[0]?.id ?? 0) > newestKnown) {
        // Missed more than a page: start over from the newest messages.
        const unsent = thread.messages.filter((m) => m.pending || m.failed);
        this.patchThread(id, (t) => ({ ...t, messages: [...page.items.map(toUi), ...unsent], hasMore: true }));
      } else {
        page.items.forEach((message) => this.receive(message));
      }
      this.markActiveRead();
    } catch {
      /* the next reconnection will try again */
    }
  }

  // --- Messages -------------------------------------------------------------

  public async loadOlder(): Promise<void> {
    const id = this.activeId();
    const thread = id === null ? null : this.threadsState()[id];
    if (id === null || !thread || thread.loading || !thread.hasMore) return;
    await this.loadPage(id, thread.messages.find((m) => !m.pending)?.id);
  }

  public send(content: string, attachments: Attachment[] = []): void {
    const conversation = this.active();
    const me = this.me();
    const text = content.trim();
    if (!conversation || !me || (!text && !attachments.length)) return;

    const clientId = newClientId();
    const replyTo = this.replyingTo();
    const options = this.sendOptions();
    const optimistic: UiMessage = {
      id: Number.MAX_SAFE_INTEGER,
      key: clientId,
      client_id: clientId,
      conversation_id: conversation.id,
      sender_id: me.id,
      sender: me,
      content: text,
      message_type: attachments.length ? (attachments.every((a) => a.is_image) ? 'image' : attachments.every((a) => a.is_video) ? 'video' : 'file') : 'text',
      reply_to_id: replyTo?.id ?? null,
      reply_to: replyTo ? { id: replyTo.id, sender_id: replyTo.sender_id, content: replyTo.content, message_type: replyTo.message_type } : null,
      created_at: new Date().toISOString(),
      expires_at: options.expiresIn ? new Date(Date.now() + options.expiresIn * 1000).toISOString() : null,
      view_once: options.viewOnce,
      attachments,
      pending: true,
    };
    this.replyState.update((state) => ({ ...state, [conversation.id]: null }));
    this.patchThread(conversation.id, (thread) => ({ ...thread, messages: [...thread.messages, optimistic] }));
    this.patchConversation(conversation.id, (c) => ({ ...c, last_message: optimistic }));
    this.deliver(conversation.id, optimistic);
  }

  /** Retries a failed message with the same client_id (the API deduplicates). */
  public retry(message: UiMessage): void {
    this.patchMessage(message.conversation_id, message.key, { failed: false, pending: true });
    this.deliver(message.conversation_id, message);
  }

  public discard(message: UiMessage): void {
    this.patchThread(message.conversation_id, (thread) => ({
      ...thread,
      messages: thread.messages.filter((m) => m.key !== message.key),
    }));
  }

  /** A message arrived (from the API or the socket). Idempotent. */
  public receive(message: Message): void {
    const me = this.me()?.id;
    const known = this.conversationsState().some((c) => c.id === message.conversation_id);
    if (!known) {
      void this.refreshConversation(message.conversation_id);
      return;
    }
    let isNew = false;
    this.patchThread(message.conversation_id, (thread) => {
      const index = thread.messages.findIndex(
        (m) => m.id === message.id || (message.client_id !== null && m.client_id === message.client_id),
      );
      if (index >= 0) {
        // Confirms an optimistic message even before the first page arrives.
        const messages = [...thread.messages];
        messages[index] = { ...toUi(message), key: messages[index].key };
        return { ...thread, messages };
      }
      // Not loaded yet: the first page will bring it.
      if (!thread.loaded) return thread;
      isNew = true;
      return { ...thread, messages: insertSorted(thread.messages, toUi(message)) };
    });

    const thread = this.threadsState()[message.conversation_id];
    if (!thread?.loaded) isNew = true;
    const viewing = this.activeId() === message.conversation_id && isPageVisible();
    this.patchConversation(message.conversation_id, (c) => ({
      ...c,
      last_message: !c.last_message || message.id >= c.last_message.id || c.last_message.client_id === message.client_id ? message : c.last_message,
      last_message_at: message.created_at,
      unread_count: isNew && message.sender_id !== me && !viewing ? c.unread_count + 1 : c.unread_count,
    }));
    if (message.sender_id === me) {
      this.movePointers(message.conversation_id, me, message.id, message.id);
    } else if (viewing) {
      this.markActiveRead();
    }
  }

  public applyRead(event: ReadEvent): void {
    this.movePointers(event.conversationId, event.userId, event.lastReadMessageId, event.lastReadMessageId);
    if (event.userId === this.me()?.id) {
      this.patchConversation(event.conversationId, (c) => ({ ...c, unread_count: 0 }));
    }
  }

  public applyDelivered(event: DeliveredEvent): void {
    this.movePointers(event.conversationId, event.userId, null, event.lastDeliveredMessageId);
  }

  /** Marks the open conversation as read up to its newest message. */
  public markActiveRead(): void {
    const conversation = this.active();
    const me = this.me()?.id;
    if (!conversation || me === undefined || !isPageVisible()) return;
    const newest = this.threadsState()[conversation.id]?.messages.filter((m) => !m.pending).at(-1)?.id ?? conversation.last_message?.id;
    const mine = conversation.members.find((m) => m.user_id === me);
    if (!newest || (conversation.unread_count === 0 && (mine?.last_read_message_id ?? 0) >= newest)) return;
    this.patchConversation(conversation.id, (c) => ({ ...c, unread_count: 0 }));
    this.movePointers(conversation.id, me, newest, newest);
    this.api.markRead(conversation.id, newest).subscribe({ error: () => undefined });
  }

  /** ✓ sent, ✓✓ delivered, blue ✓✓ read, for one of my messages. */
  public deliveryState(conversation: Conversation, message: UiMessage): DeliveryState {
    if (message.failed) return 'failed';
    if (message.pending) return 'sending';
    const others = conversation.members.filter((m) => m.user_id !== message.sender_id);
    if (!others.length) return 'sent';
    if (others.every((m) => (m.last_read_message_id ?? 0) >= message.id)) return 'read';
    if (others.every((m) => (m.last_delivered_message_id ?? 0) >= message.id)) return 'delivered';
    return 'sent';
  }

  public reset(): void {
    this.conversationsState.set([]);
    this.threadsState.set({});
    this.replyState.set({});
    this.optionsState.set({});
    this.activeId.set(null);
    this.loaded.set(false);
  }

  // --- Internals ------------------------------------------------------------

  private deliver(conversationId: number, message: UiMessage): void {
    const body: SendMessageBody = { client_id: message.client_id ?? undefined };
    if (message.content) body.content = message.content;
    if (message.attachments?.length) body.attachment_ids = message.attachments.map((a) => a.id);
    if (message.reply_to_id) body.reply_to_id = message.reply_to_id;
    if (message.view_once) body.view_once = true;
    if (message.expires_at && !message.view_once) {
      // The optimistic deadline was computed when composing; send the remaining seconds.
      body.expires_in = Math.max(10, Math.round((new Date(message.expires_at).getTime() - Date.now()) / 1000));
    }
    this.sender(conversationId, body).subscribe({
      next: (saved) => this.receive(saved),
      error: (error: unknown) => {
        this.patchMessage(conversationId, message.key, { pending: false, failed: true });
        this.toast.error(errorMessage(error, 'No se pudo enviar el mensaje'));
      },
    });
  }

  private async loadPage(id: number, before?: number): Promise<void> {
    this.patchThread(id, (thread) => ({ ...thread, loading: true, error: null }));
    try {
      const page = await firstValueFrom(this.api.messages(id, before, PAGE_SIZE));
      this.patchThread(id, (thread) => {
        const known = new Set(thread.messages.map((m) => m.id));
        const byClientId = new Map(thread.messages.filter((m) => m.client_id).map((m) => [m.client_id, m]));
        // Optimistic messages the server already saved: keep the server copy, with the same key.
        const confirmed = new Map<string, UiMessage>();
        const older: UiMessage[] = [];
        for (const item of page.items) {
          if (known.has(item.id)) continue;
          const optimistic = item.client_id ? byClientId.get(item.client_id) : undefined;
          if (optimistic) confirmed.set(optimistic.key, { ...toUi(item), key: optimistic.key });
          else older.push(toUi(item));
        }
        const current = thread.messages.map((m) => confirmed.get(m.key) ?? m);
        return { ...thread, messages: [...older, ...current], hasMore: page.hasMore, loading: false, loaded: true };
      });
    } catch (error) {
      const message = errorMessage(error, 'No se pudieron cargar los mensajes');
      this.patchThread(id, (thread) => ({ ...thread, loading: false, error: message }));
    }
  }

  private forget(id: number): void {
    this.conversationsState.update((list) => list.filter((c) => c.id !== id));
    this.threadsState.update(({ [id]: _gone, ...rest }) => rest);
    this.replyState.update(({ [id]: _gone, ...rest }) => rest);
    this.optionsState.update(({ [id]: _gone, ...rest }) => rest);
    if (this.activeId() === id) this.activeId.set(null);
  }

  /** Removes messages from a thread and keeps the list preview and unread count honest. */
  private removeWhere(conversationId: number, gone: (message: UiMessage) => boolean): void {
    const me = this.me()?.id;
    const thread = this.threadsState()[conversationId];
    const conversation = this.conversationsState().find((c) => c.id === conversationId);
    if (!conversation) return;
    const removed = thread ? thread.messages.filter(gone) : [];
    if (thread && removed.length) {
      const ids = new Set(removed.map((m) => m.key));
      this.patchThread(conversationId, (t) => ({
        ...t,
        messages: t.messages
          .filter((m) => !ids.has(m.key))
          // A quote of a destroyed message must not keep its text alive.
          .map((m) => (m.reply_to && removed.some((r) => r.id === m.reply_to!.id) ? { ...m, reply_to: null } : m)),
      }));
    }
    const lastGone = conversation.last_message && (gone(toUi(conversation.last_message)) || removed.some((m) => m.id === conversation.last_message!.id));
    const myRead = conversation.members.find((m) => m.user_id === me)?.last_read_message_id ?? 0;
    const unreadGone = removed.filter((m) => m.sender_id !== me && m.id > myRead).length;
    if (!lastGone && !unreadGone) return;
    const remaining = this.threadsState()[conversationId]?.messages.filter((m) => !m.pending && !m.failed);
    this.patchConversation(conversationId, (c) => ({
      ...c,
      last_message: lastGone ? (remaining?.at(-1) ?? null) : c.last_message,
      unread_count: Math.max(0, c.unread_count - unreadGone),
    }));
    // Without the thread loaded, the server knows the real preview and count.
    if (lastGone && !thread?.loaded) void this.refreshConversation(conversationId);
  }

  private upsert(conversation: Conversation): void {
    this.conversationsState.update((list) => {
      const index = list.findIndex((c) => c.id === conversation.id);
      if (index < 0) return [...list, conversation];
      const copy = [...list];
      copy[index] = conversation;
      return copy;
    });
  }

  private movePointers(conversationId: number, userId: number, read: number | null, delivered: number | null): void {
    this.patchConversation(conversationId, (c) => ({
      ...c,
      members: c.members.map((member) =>
        member.user_id !== userId
          ? member
          : {
              ...member,
              last_read_message_id: read === null ? member.last_read_message_id : Math.max(member.last_read_message_id ?? 0, read),
              last_delivered_message_id:
                delivered === null ? member.last_delivered_message_id : Math.max(member.last_delivered_message_id ?? 0, delivered),
            },
      ),
    }));
  }

  private patchConversation(id: number, change: (conversation: Conversation) => Conversation): void {
    this.conversationsState.update((list) => list.map((c) => (c.id === id ? change(c) : c)));
  }

  private patchThread(id: number, change: (thread: Thread) => Thread): void {
    this.threadsState.update((threads) => ({ ...threads, [id]: change(threads[id] ?? emptyThread()) }));
  }

  private patchMessage(conversationId: number, key: string, changes: Partial<UiMessage>): void {
    this.patchThread(conversationId, (thread) => ({
      ...thread,
      messages: thread.messages.map((m) => (m.key === key ? { ...m, ...changes } : m)),
    }));
  }
}

/** Keeps server order (by id); optimistic messages stay at the end. */
function insertSorted(messages: UiMessage[], message: UiMessage): UiMessage[] {
  const copy = [...messages];
  let index = copy.length;
  while (index > 0 && (copy[index - 1].pending || copy[index - 1].failed || copy[index - 1].id > message.id)) index--;
  copy.splice(index, 0, message);
  return copy;
}

function isPageVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden';
}
