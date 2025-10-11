export interface IFriendship {
  id: string;
  name: string;
  username: string;
  avatar_url?: string;
  status?: string;
  initials: string;
  avatarColor: string;
  last_seen?: string;
  is_online: boolean;
}