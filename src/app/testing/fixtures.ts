import type { AuthSession, Conversation, ConversationMember, Message, User } from '../core/models';

export const API = 'http://api.test';

export const user = (id: number, username = `user${id}`, extra: Partial<User> = {}): User => ({
  id,
  username,
  first_name: null,
  last_name: null,
  avatar_url: null,
  ...extra,
});

export const session = (u: User = user(1, 'ana'), n = 1): AuthSession => ({
  user: u,
  accessToken: `access-${n}`,
  expiresIn: 900,
  refreshToken: `refresh-${n}`,
});

export const member = (conversationId: number, u: User, extra: Partial<ConversationMember> = {}): ConversationMember => ({
  id: conversationId * 100 + u.id,
  conversation_id: conversationId,
  user_id: u.id,
  user: u,
  last_read_message_id: null,
  last_delivered_message_id: null,
  left_at: null,
  ...extra,
});

export const conversation = (id: number, users: User[], extra: Partial<Conversation> = {}): Conversation => ({
  id,
  type: 'direct',
  name: null,
  avatar_url: null,
  last_message_at: null,
  members: users.map((u) => member(id, u)),
  last_message: null,
  unread_count: 0,
  ...extra,
});

export const message = (id: number, conversationId: number, senderId: number, extra: Partial<Message> = {}): Message => ({
  id,
  conversation_id: conversationId,
  sender_id: senderId,
  content: `mensaje ${id}`,
  message_type: 'text',
  reply_to_id: null,
  client_id: null,
  created_at: new Date(2026, 9, 3, 10, 0, id).toISOString(),
  ...extra,
});
