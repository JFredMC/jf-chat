import { IAudit } from "../../../../types/audit";
import { EConversationType } from "../enums/conversation-type.enum";
import { IConversationMembers } from "./conversation-member.type";

export interface IConversation extends IAudit {
  id?: number;
  name?: string;
  type?: EConversationType;
  is_active?: boolean;
  last_message_at?: string;
  members: IConversationMembers[];
}