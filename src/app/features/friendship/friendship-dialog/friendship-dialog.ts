import { Component, inject, output, signal } from '@angular/core';
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
  public friends = signal<IFriendship[]>([]);
  public currentUser = this.authService.currentUser;
  public isLoading = this.friendshipService.isLoading;
  public isLoadingBtn = this.friendshipService.isLoadingBtn;
  public searchQuery = signal('');
  public selectedFriend = signal<{friendshipId: string, contactData: IUser} | null>(null);

  constructor() {
    // Cargar contactos al inicializar el componente
    const userId = this.currentUser()?.id;
    if (userId) {
      this.friendshipService.getAllByUser(userId).subscribe((response) => {
        this.friends.set(response);
      });
    }
  }

  public filteredContacts() {
    const query = this.searchQuery().toLowerCase();
    const friendships = this.friends();
    
    if (!query) return friendships;

    return friendships.filter((friendship) => 
      friendship.friend.first_name?.toLowerCase().includes(query) ||
      friendship.friend.last_name?.toLowerCase().includes(query) ||
      friendship.friend.username.toLowerCase().includes(query)
    );
  }

  public selectContact(contact: IUser) {
    const friendship = this.friends().find(f => f.friend.id === contact.id);
    if (!friendship) return;

    this.selectedFriend.set({
      friendshipId: friendship.id,
      contactData: contact,
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
        friendData: selected.contactData,
      });
      this.closed.emit();
    }
  }

  public stopPropagation(event: Event) {
    event.stopPropagation();
  }

  getContactDisplayName(contact: IUser): string {
    if (contact.first_name && contact.last_name) {
      return `${contact.first_name} ${contact.last_name}`;
    }
    return contact.username;
  }

  getContactInitials(contact: IUser): string {
    return this.friendshipService.getUserInitials(contact);
  }

  getContactAvatarColor(contact: IUser): string {
    return this.friendshipService.generateAvatarColor(contact.id || 0);
  }

  isContactOnline(contact: IUser): boolean {
    return contact.status === 'online';
  }

  getLastSeen(contact: IUser): string {
    return contact.last_seen ? this.friendshipService.formatLastSeen(contact.last_seen) : '';
  }

  isSelected(contact: IUser): boolean {
    const selected = this.selectedFriend();
    return selected ? selected.contactData.id === contact.id : false;
  }
}