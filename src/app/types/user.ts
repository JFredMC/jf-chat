import { IAudit } from "./audit";

export interface IUser extends IAudit {
  id: number;
  username: string;
  email: string;
  name?: string;
  avatar?: string;
}