import { IMessage } from "../features/chat/messages/types/message.type";
import { IAudit } from "./audit";

export interface IAttachment extends IAudit {
  id: number;
  message: IMessage;
  file_url: string;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  thumbnail_url: string | null;
}