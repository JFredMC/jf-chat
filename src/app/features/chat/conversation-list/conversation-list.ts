import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConversationService } from '../conversations/services/conversation.service';
import { AuthService } from '../../../services/auth.service';
import { FriendshipService } from '../../friendship/services/friendship.service';
import { IConversation } from '../conversations/types/conversation.type';
import { IUser } from '../../../types/user';

@Component({
  selector: 'app-conversation-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './conversation-list.html',
  styleUrl: './conversation-list.scss'
})
export class ConversationList {
  private readonly conversationService = inject(ConversationService);
  private readonly authService = inject(AuthService);
  private readonly friendshipService = inject(FriendshipService);

  public conversations = this.conversationService.conversations;
  public activeConversation = this.conversationService.activeConversation;
  public isLoading = this.conversationService.isLoading;
  public currentUser = this.authService.currentUser;

  // Método para seleccionar conversación (se llamará desde el template)
  selectConversation(conversation: IConversation): void {
    this.conversationService.setActiveConversation(conversation);
  }

  getConversationDisplayName(conversation: IConversation): string {
    if (conversation.type === 'direct' && conversation.members) {
      const otherMember = conversation.members.find(m => m.user_id !== this.currentUser()?.id);
      if (otherMember?.user) {
        return this.getUserDisplayName(otherMember.user);
      }
    }
    return conversation.name || 'Grupo sin nombre';
  }

  getUserDisplayName(user: IUser): string {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.username;
  }

  getConversationInitials(conversation: IConversation): string {
    if (conversation.type === 'direct' && conversation.members) {
      const otherMember = conversation.members.find(m => m.user_id !== this.currentUser()?.id);
      if (otherMember?.user) {
        return this.friendshipService.getUserInitials(otherMember.user);
      }
    }
    return conversation.name?.substring(0, 2).toUpperCase() || 'GP';
  }

  getLastMessagePreview(conversation: IConversation): string {
    // Aquí puedes implementar la lógica para mostrar el último mensaje
    return 'Último mensaje...';
  }

  formatLastActivity(conversation: IConversation): string {
    if (!conversation.last_message_at) return '';
    return this.friendshipService.formatLastSeen(conversation.last_message_at);
  }
}