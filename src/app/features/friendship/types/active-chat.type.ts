import { IUser } from "../../../types/user";

export interface ActiveChat {
  friendId: string;
  friendName: string;
  friendData: IUser;
}
