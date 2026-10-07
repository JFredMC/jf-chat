/** Shapes returned by the Velo API (jf-chat-be). */

export type UserStatus = 'online' | 'offline' | 'away' | 'busy';

export interface User {
  id: number;
  username: string;
  avatar_url: string | null;
  /** Personal status ("estado personal"), up to 140 characters. */
  status_message?: string | null;
  status?: UserStatus;
  last_seen?: string | null;
  /** Privacy: others never learn when this user was last online. */
  hide_last_seen?: boolean;
  /** Privacy: others never see the "escribiendo…" indicator. */
  hide_typing?: boolean;
  created_at?: string;
}

export interface PrivacySettings {
  hide_last_seen: boolean;
  hide_typing: boolean;
}

export interface InviteCode {
  code: string;
}

export interface AuthSession {
  user: User;
  accessToken: string;
  expiresIn: string | number;
  refreshToken: string;
}

/** Username and password only: Velo never asks for a real name or an email. */
export interface RegisterRequest {
  username: string;
  password: string;
}

export type FriendshipStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';

export interface Friendship {
  id: number;
  status: FriendshipStatus;
  /** Seen from the current user: who sent the request. */
  direction: 'incoming' | 'outgoing';
  friend: User;
  created_at?: string;
  updated_at?: string;
}

export interface ConversationMember {
  id: number;
  conversation_id: number;
  user_id: number;
  user: User;
  role?: string;
  last_read_message_id: number | null;
  last_delivered_message_id: number | null;
  left_at: string | null;
}

export interface Attachment {
  id: number;
  message_id: number | null;
  file_name: string;
  file_type: string;
  file_size: number;
  is_image: boolean;
  is_video?: boolean;
}

export type MessageType = 'text' | 'image' | 'video' | 'file' | 'system';

/** Minimal quote of the message being replied to (null once it self-destructed). */
export interface MessageQuote {
  id: number;
  sender_id: number;
  content: string;
  message_type: MessageType;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender?: User;
  content: string;
  message_type: MessageType;
  reply_to_id: number | null;
  reply_to?: MessageQuote | null;
  client_id: string | null;
  created_at: string;
  /** When the server destroys it (ephemeral or view-once after reading). */
  expires_at?: string | null;
  /** Disappears shortly after the recipient opens it. */
  view_once?: boolean;
  attachments?: Attachment[];
}

export interface Conversation {
  id: number;
  type: 'direct' | 'group' | 'channel';
  name: string | null;
  avatar_url: string | null;
  last_message_at: string | null;
  members: ConversationMember[];
  last_message: Message | null;
  unread_count: number;
  /** Every message self-destructs this many seconds after being sent (24 h). */
  retention_seconds?: number;
}

export interface MessagePage {
  items: Message[];
  hasMore: boolean;
}

export interface PresenceUpdate {
  userId: number;
  online: boolean;
  lastSeen: string | null;
}

export interface TypingEvent {
  conversationId: number;
  userId: number;
  username: string;
  isTyping: boolean;
}

export interface ReadEvent {
  conversationId: number;
  userId: number;
  lastReadMessageId: number;
}

export interface DeliveredEvent {
  conversationId: number;
  userId: number;
  lastDeliveredMessageId: number;
}

export interface Ack<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

/** Velo only knows usernames: that is the only name ever shown. */
export const displayName = (user: Pick<User, 'username'> | null | undefined): string => (user ? user.username : 'Usuario');

export const STATUS_MESSAGE_MAX = 140;

/**
 * Absolute URL of an avatar. The API issues paths like `/avatars/1/x.png`
 * (resolved against the API); data:, blob: and https: URLs pass through.
 */
export const avatarSrc = (url: string | null | undefined, apiUrl: string): string | null => {
  if (!url) return null;
  if (url.startsWith('/')) return `${apiUrl}${url}`;
  return /^(https:|data:image\/|blob:)/.test(url) ? url : null;
};
