import { IAudit } from "../../../../types/audit";
import { IUser } from "../../../../types/user";
import { EMessageStatuses } from "../enum/message-status.enum";
import { IMessage } from "./message.type";

export interface IMessageStatus extends IAudit {
  id?: number;
  message_id?: number;
  user_id?: number;
  status?: EMessageStatuses;
  read_at?: string;
  message?: IMessage;
  user?: IUser;
}