import { IAudit } from "../../../types/audit";
import { IUser } from "../../../types/user";

export interface IFriendship extends IAudit {
  id: string;
  user_id: number;
  friend_id: number;
  status?: string;
  user: IUser;
  friend: IUser;
}