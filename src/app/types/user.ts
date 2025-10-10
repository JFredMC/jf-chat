import { IAudit } from "./audit";

export interface IUser extends IAudit {
  id: number;
  username: string;
  fist_name: string;
  last_name: string;
  avatar_url?: string;
  status: string;
  is_active: boolean;
}