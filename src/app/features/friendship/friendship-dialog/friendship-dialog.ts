import { Component, effect, inject, output, signal } from '@angular/core';
import { IFriendship } from '../types/friendship.type';
import { FriendshipService } from '../services/friendship.service';
import { AuthService } from '../../../services/auth.service';
import { IUser } from '../../../types/user';

@Component({
  selector: 'app-friendship-dialog',
  imports: [],
  templateUrl: './friendship-dialog.html',
  styleUrl: './friendship-dialog.scss'
})
export class FriendshipDialog {
  private readonly friendshipService = inject(FriendshipService);
  private readonly authService = inject(AuthService);

  public friendSelected = output<{friendId: string, friendData: IUser}>();
  public closed = output<void>();

  // Signals
  public friends = this.friendshipService.friends;
  public currentUser = this.authService.currentUser;
  public isLoading = this.friendshipService.isLoading;
  public isLoadingBtn = this.friendshipService.isLoadingBtn;
  public searchQuery = signal('');
  public selectedFriend = signal<{friendshipId: string, friendData: IUser} | null>(null);

  constructor() {
    // Cargar amigos al inicializar el componente
    this.friendshipService.getAll().subscribe();
  }

  public filteredFriends() {
    const query = this.searchQuery().toLowerCase();
    const currentUserId = this.currentUser()?.id;
    
    if (!currentUserId) return [];

    const friendships = this.friends();
    if (!query) return friendships;

    return friendships.filter(friendship => {
      const friendUser = this.friendshipService.getFriendUser(friendship, currentUserId);
      return (
        friendUser.first_name?.toLowerCase().includes(query) ||
        friendUser.last_name?.toLowerCase().includes(query) ||
        friendUser.username.toLowerCase().includes(query)
      );
    });
  }

  public selectFriend(friendship: IFriendship) {
    const currentUserId = this.currentUser()?.id;
    if (!currentUserId) return;

    const friendUser = this.friendshipService.getFriendUser(friendship, currentUserId);
    this.selectedFriend.set({
      friendshipId: friendship.id,
      friendData: friendUser
    });
  }

  public onSearchChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  public confirmSelection() {
    const selected = this.selectedFriend();
    if (selected) {
      this.friendSelected.emit({
        friendId: selected.friendshipId,
        friendData: selected.friendData
      });
      this.closed.emit();
    }
  }

  public stopPropagation(event: Event) {
    event.stopPropagation();
  }

  // Helper methods para el template
  getFriendUser(friendship: IFriendship): IUser {
    const currentUserId = this.currentUser()?.id;
    return currentUserId ? this.friendshipService.getFriendUser(friendship, currentUserId) : friendship.friend;
  }

  getFriendDisplayName(friendUser: IUser): string {
    if (friendUser.first_name && friendUser.last_name) {
      return `${friendUser.first_name} ${friendUser.last_name}`;
    }
    return friendUser.username;
  }

  getFriendInitials(friendUser: IUser): string {
    return this.friendshipService.getUserInitials(friendUser);
  }

  getFriendAvatarColor(friendUser: IUser): string {
    return this.friendshipService.generateAvatarColor(friendUser.id || 0);
  }

  isFriendOnline(friendUser: IUser): boolean {
    return friendUser.status === 'online';
  }

  getLastSeen(friendUser: IUser): string {
    return friendUser.last_seen ? this.friendshipService.formatLastSeen(friendUser.last_seen) : '';
  }

  isSelected(friendship: IFriendship): boolean {
    const selected = this.selectedFriend();
    const currentUserId = this.currentUser()?.id;
    if (!selected || !currentUserId) return false;

    const friendUser = this.friendshipService.getFriendUser(friendship, currentUserId);
    return selected.friendData.id === friendUser.id;
  }
}