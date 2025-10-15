import { IMessage } from "../features/chat/messages/types/message.type";

export interface ServerToClientEvents {
  'new_message': (message: IMessage) => void;
  'message_read': (data: { messageId: number; userId: number }) => void;
  'user_status': (data: { userId: number; status: string }) => void;
  'user_joined': (data: { clientId: string; userId?: number }) => void;
  'user_left': (data: { clientId: string; userId?: number }) => void;
  'message_delivered': (data: { status: string; timestamp: Date }) => void;
}

export interface ClientToServerEvents {
  'send_message': (message: IMessage) => void;
  'mark_read': (data: { messageId: number; userId: number }) => void;
  'join_conversation': (conversationId: number) => void;
  'leave_conversation': (conversationId: number) => void;
  'typing_start': (data: { conversationId: number; userId: number }) => void;
  'typing_stop': (data: { conversationId: number; userId: number }) => void;
}