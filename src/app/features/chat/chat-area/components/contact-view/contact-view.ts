import { CommonModule } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';
import { FriendshipService } from '../../../../friendship/services/friendship.service';
import { IUser } from '../../../../../types/user';

@Component({
  selector: 'app-contact-view',
  imports: [CommonModule],
  templateUrl: './contact-view.html',
  styleUrl: './contact-view.scss'
})
export class ContactView {
  private readonly friendshipService = inject(FriendshipService);

  public contact = input.required<IUser>();
  public closed = output<void>();
  public sendMessage = output<void>();

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
}
