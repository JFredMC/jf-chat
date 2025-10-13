import { IFriendship } from "../features/friendship/types/friendship.type";
import { IAudit } from "./audit";

export interface IUser extends IAudit {
  id?: number;
  username: string;
  password: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  status?: string;
  is_active?: boolean;
  last_seen?: string;
  friendships?: IFriendship[];
}