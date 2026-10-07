import { Injectable, inject } from '@angular/core';
import { Observable, defer, firstValueFrom, type Subscription } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import type { Message } from '../../core/models';
import { RealtimeConnection, type ServerEvent } from '../../core/realtime/realtime-connection';
import { ToastService } from '../../core/ui/toast.service';
import { FriendsStore } from '../friends/friends.store';
import { ChatApi, type SendMessageBody } from './chat.api';
import { ChatStore } from './chat.store';
import { PresenceStore } from './presence.store';

/** Ack errors that mean "the socket can't do it right now": fall back to REST. */
const TRANSPORT_ERRORS = new Set(['Sin conexión en tiempo real', 'El servidor no respondió']);

/**
 * Connects the realtime events with the stores: new messages, typing,
 * presence, read/delivery receipts and friendship changes. Messages go over
 * the socket (with acknowledgement) and fall back to REST; both are
 * idempotent thanks to the client_id.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly connection = inject(RealtimeConnection);
  private readonly chat = inject(ChatStore);
  private readonly presence = inject(PresenceStore);
  private readonly friends = inject(FriendsStore);
  private readonly auth = inject(AuthStore);
  private readonly api = inject(ChatApi);
  private readonly toast = inject(ToastService);

  private subscription: Subscription | null = null;
  private connectedBefore = false;

  public readonly status = this.connection.status;

  public start(): void {
    if (this.subscription) return;
    this.subscription = this.connection.events.subscribe((event) => this.handle(event));
    this.chat.useSender((id, body) => this.send(id, body));
    this.connection.connect();
  }

  public stop(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
    this.connectedBefore = false;
    this.chat.useSender(null);
    this.connection.disconnect();
  }

  public retry(): void {
    this.connection.retry();
  }

  /** "Escribiendo…" for the other members (fire and forget). */
  public typing(conversationId: number, isTyping: boolean): void {
    if (this.status() === 'online') void this.connection.emit('typing', { conversationId, isTyping });
  }

  private send(conversationId: number, body: SendMessageBody): Observable<Message> {
    return defer(async () => {
      if (this.status() === 'online') {
        const ack = await this.connection.emit('send_message', { conversationId, ...body });
        if (ack.ok) return ack.data as Message;
        if (!TRANSPORT_ERRORS.has(ack.error ?? '')) throw new Error(ack.error || 'No se pudo enviar el mensaje');
      }
      return firstValueFrom(this.api.send(conversationId, body));
    });
  }

  private handle(event: ServerEvent): void {
    const me = this.auth.user()?.id;
    switch (event.type) {
      case 'new_message': {
        const message = event.data;
        this.presence.clearTyping(message.conversation_id, message.sender_id);
        this.chat.receive(message);
        if (message.sender_id !== me) {
          void this.connection.emit('mark_delivered', { conversationId: message.conversation_id, messageId: message.id });
        }
        break;
      }
      case 'typing':
        if (event.data.userId !== me) this.presence.setTyping(event.data);
        break;
      case 'conversation_read':
        this.chat.applyRead(event.data);
        break;
      case 'conversation_delivered':
        this.chat.applyDelivered(event.data);
        break;
      case 'conversation_updated':
        void this.chat.refreshConversation(event.data.conversationId);
        break;
      case 'presence_snapshot':
        this.presence.apply(event.data);
        // Reconnected: catch up with what happened while offline.
        if (this.connectedBefore) void this.resync();
        this.connectedBefore = true;
        break;
      case 'presence':
        this.presence.apply([event.data]);
        break;
      case 'friendship_updated':
        void this.onFriendshipUpdated(event.data.status);
        break;
      case 'user_updated':
        this.chat.patchUser(event.data);
        this.friends.patchUser(event.data);
        if (event.data.id === me) this.auth.patchSelf(event.data);
        break;
      case 'messages_expiring':
        this.chat.applyExpiring(event.data.conversationId, event.data.items);
        break;
      case 'messages_deleted':
        this.chat.applyDeleted(event.data.conversationId, event.data.ids);
        break;
      case 'conversation_destroyed':
        this.chat.applyDestroyed(event.data.conversationId);
        break;
      case 'session_expired':
        break;
    }
  }

  private async resync(): Promise<void> {
    await Promise.all([this.chat.resync(), this.friends.load()]);
  }

  private async onFriendshipUpdated(status: string): Promise<void> {
    const before = this.friends.incoming().length;
    const known = new Set(this.friends.friends().map((f) => f.id));
    await this.friends.load();
    // The invite owner is the friendship's "outgoing" side; the redeemer already got its own toast.
    const viaMyCode = this.friends.friends().some((f) => !known.has(f.id) && f.direction === 'outgoing');
    if (status === 'pending' && this.friends.incoming().length > before) this.toast.info('Tienes una solicitud de contacto pendiente');
    if (status === 'accepted' && viaMyCode) {
      this.toast.success('Alguien usó tu código. ¡Ya pueden chatear!');
      void this.friends.refreshInviteIfLoaded();
    }
  }
}
