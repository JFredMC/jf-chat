import { IUser } from "./user";

export interface IAudit {
    createdAt?: string;
    createdBy?: IUser;
    updatedAt?: string;
    updatedBy?: IUser;
}