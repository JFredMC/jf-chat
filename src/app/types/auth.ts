import { IUser } from "./user";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: IUser;
  accesToken: string;
  refreshToken: string;
}