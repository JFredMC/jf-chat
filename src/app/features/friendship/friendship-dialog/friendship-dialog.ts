import { Component, inject, output, signal } from '@angular/core';
import { IFriendship } from '../types/friendship.type';
import { FriendshipService } from '../services/friendship.service';
import { AuthService } from '../../../services/auth.service';
import { IUser } from '../../../types/user';
import { CommonModule } from '@angular/common';
import { UsersService } from '../../user/services/user.service';

@Component({
  selector: 'app-friendship-dialog',
  imports: [CommonModule],
  templateUrl: './friendship-dialog.html',
  styleUrl: './friendship-dialog.scss'
})
export class FriendshipDialog {
  private readonly friendshipService = inject(FriendshipService);
  private readonly authService = inject(AuthService);
  private readonly usersService = inject(UsersService);

  public friendSelected = output<{friendId: string, friendData: IUser}>();
  public closed = output<void>();

  // Signals
  public friends = signal<IFriendship[]>([]);
  public searchResults = signal<IUser[]>([]);
  public currentUser = this.authService.currentUser;
  public isLoading = this.friendshipService.isLoading;
  public isLoadingBtn = this.friendshipService.isLoadingBtn;
  public searchQuery = signal('');
  public selectedFriend = signal<{friendshipId: string, contactData: IUser} | null>(null);
  public isSearching = signal(false);
  public activeTab = signal<'contacts' | 'search'>('contacts');

  constructor() {
    this.loadContacts();
  }

  private loadContacts() {
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

  public onSearchChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const query = input.value.trim();
    this.searchQuery.set(query);

    if (query.length > 2) {
      this.activeTab.set('search');
      this.isSearching.set(true);
      this.usersService.searchUsers(query).subscribe({
        next: (users) => {
          // Filtrar usuarios que ya son amigos
          const friendIds = new Set(this.friends().map(f => f.friend.id));
          const filteredUsers = users.filter(user => 
            user.id !== this.currentUser()?.id && !friendIds.has(user.id)
          );
          this.searchResults.set(filteredUsers);
          this.isSearching.set(false);
        },
        error: () => {
          this.isSearching.set(false);
          this.searchResults.set([]);
        }
      });
    } else {
      this.activeTab.set('contacts');
      this.searchResults.set([]);
    }
  }

  public selectContact(contact: IUser) {
    // Verificar si es un usuario de búsqueda o un amigo existente
    const friendship = this.friends().find(f => f.friend.id === contact.id);
    
    this.selectedFriend.set({
      friendshipId: friendship?.id || '',
      contactData: contact,
    });
  }

  public addFriend(user: IUser) {
    if (!user.id) return;
    this.friendshipService.sendFriendRequest(user.id).subscribe({
      next: (newFriendship) => {
        this.friends.update(friends => [...friends, newFriendship]);
        this.activeTab.set('contacts');
        this.searchQuery.set('');
        this.searchResults.set([]);
      },
      error: (error) => {
        console.error('Error al enviar solicitud de amistad:', error);
      }
    });
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

  // Métodos auxiliares existentes...
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