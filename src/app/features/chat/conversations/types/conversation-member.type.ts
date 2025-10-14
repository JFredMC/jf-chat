import { IAudit } from "../../../../types/audit";
import { IUser } from "../../../../types/user";
import { EConversationNumberRole } from "../enums/conversation-member.enum";
import { IConversation } from "./conversation.type";

export interface IConversationMembers extends IAudit {
  id?: number;
  conversation_id?: number;
  user_id?: number;
  role?: EConversationNumberRole;
  joined_at?: string;
  left_at?: string;
  muted_until?: string;
  conversation?: IConversation;
  user?: IUser;
}