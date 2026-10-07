import type { Signal } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Ack, DeliveredEvent, Message, PresenceUpdate, ReadEvent, TypingEvent, User } from '../models';

/**
 * - `idle`: not started (signed out).
 * - `connecting`: first connection attempt.
 * - `online`: connected and authenticated.
 * - `reconnecting`: the connection dropped; retrying on its own.
 * - `offline`: gave up after repeated failures; needs `retry()`.
 */
export type ConnectionStatus = 'idle' | 'connecting' | 'online' | 'reconnecting' | 'offline';

export interface ServerEvents {
  new_message: Message;
  typing: TypingEvent;
  conversation_read: ReadEvent;
  conversation_delivered: DeliveredEvent;
  conversation_updated: { conversationId: number };
  presence_snapshot: PresenceUpdate[];
  presence: PresenceUpdate;
  friendship_updated: { friendshipId: number; status: string };
  /** Someone (or you) changed their photo, personal status or privacy switches. */
  user_updated: User;
  /** View-once messages were opened: they now have a deadline. */
  messages_expiring: { conversationId: number; items: { id: number; expires_at: string }[] };
  /** The server destroyed these messages (expired, or older than 24 h). */
  messages_deleted: { conversationId: number; ids: number[] };
  /** One of the two pressed «Autodestruir»: the whole chat is gone. */
  conversation_destroyed: { conversationId: number };
  session_expired: { message: string };
}

export type ServerEvent = { [K in keyof ServerEvents]: { type: K; data: ServerEvents[K] } }[keyof ServerEvents];

export interface SendMessagePayload {
  conversationId: number;
  content?: string;
  client_id?: string;
  reply_to_id?: number;
  attachment_ids?: number[];
  /** Ephemeral: destroyed this many seconds after sending (10–86400). */
  expires_in?: number;
  /** Destroyed shortly after the recipient opens it. */
  view_once?: boolean;
}

export interface ClientEvents {
  send_message: SendMessagePayload;
  typing: { conversationId: number; isTyping: boolean };
  mark_read: { conversationId: number; messageId?: number };
  mark_delivered: { conversationId: number; messageId?: number };
}

/**
 * Realtime transport (Socket.IO against the API, or the in-browser demo).
 * The contract is documented in jf-chat-be/docs/TIEMPO-REAL.md.
 */
export abstract class RealtimeConnection {
  public abstract readonly status: Signal<ConnectionStatus>;
  public abstract readonly events: Observable<ServerEvent>;
  public abstract connect(): void;
  public abstract disconnect(): void;
  /** Reconnects now (after `offline`). */
  public abstract retry(): void;
  /** Emits and waits for the acknowledgement; never rejects. */
  public abstract emit<K extends keyof ClientEvents>(event: K, payload: ClientEvents[K]): Promise<Ack>;
}
