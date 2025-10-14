import { IUser } from "./user";

export interface IAudit {
    created_at?: string;
    created_by?: number;
    updated_at?: string;
    updated_by?: number;
    createdByUser?: IUser;
    updatedByUser?: IUser;
}