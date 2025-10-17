import { IAttachment } from "../../../../types/attachment.type";
import { IAudit } from "../../../../types/audit";
import { IUser } from "../../../../types/user";
import { IConversation } from "../../conversations/types/conversation.type";
import { EMessageType } from "../enum/message-type.enum";
import { IMessageStatus } from "./message-status.type";

export interface IMessage extends IAudit {
  id?: number;
  conversation_id?: number;
  sender_id?: number;
  reply_to_id?: number;
  content?: string;
  message_type?: EMessageType;
  edited_at?: string;
  conversation?: IConversation;
  sender?: IUser;
  reply_to?: IMessage;
  statuses?: IMessageStatus[];
  attachments?: IAttachment[],
}