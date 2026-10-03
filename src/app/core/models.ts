/** Shapes returned by the JfChat API (jf-chat-be). */

export type UserStatus = 'online' | 'offline' | 'away' | 'busy';

export interface User {
  id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  status?: UserStatus;
  last_seen?: string | null;
  created_at?: string;
}

export interface AuthSession {
  user: User;
  accessToken: string;
  expiresIn: string | number;
  refreshToken: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  first_name?: string;
  last_name?: string;
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
}

export type MessageType = 'text' | 'image' | 'file' | 'system';

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender?: User;
  content: string;
  message_type: MessageType;
  reply_to_id: number | null;
  client_id: string | null;
  created_at: string;
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

export const displayName = (user: Pick<User, 'username' | 'first_name' | 'last_name'> | null | undefined): string => {
  if (!user) return 'Usuario';
  const full = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return full || user.username;
};
