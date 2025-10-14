import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConversationService } from '../conversations/services/conversation.service';
import { AuthService } from '../../../services/auth.service';
import { FriendshipService } from '../../friendship/services/friendship.service';
import { IConversation } from '../conversations/types/conversation.type';
import { IUser } from '../../../types/user';
import { EMessageType } from '../messages/enum/message-type.enum';
import { IMessage } from '../messages/types/message.type';

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

  public searchQuery = signal<string>('');
  public filteredConversations = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) {
      return this.conversations();
    }

    return this.conversations().filter(conversation => {
      const displayName = this.getConversationDisplayName(conversation).toLowerCase();
      const lastMessage = this.getLastMessagePreview(conversation).toLowerCase();
      
      return displayName.includes(query) || lastMessage.includes(query);
    });
  });
  public sortedConversations = computed(() => {
    const conversations = this.filteredConversations();
    return [...conversations].sort((a, b) => {
      const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return dateB - dateA;
    });
  });

  public selectConversation(conversation: IConversation): void {
    this.conversationService.setActiveConversation(conversation);
  }

  public getConversationDisplayName(conversation: IConversation): string {
    if (conversation.type === 'direct' && conversation.members) {
      const otherMember = conversation.members.find(m => m.user_id !== this.currentUser()?.id);
      if (otherMember?.user) {
        return this.getUserDisplayName(otherMember.user);
      }
    }
    return conversation.name || 'Grupo sin nombre';
  }

  private getUserDisplayName(user: IUser): string {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.username;
  }

  public getConversationInitials(conversation: IConversation): string {
    if (conversation.type === 'direct' && conversation.members) {
      const otherMember = conversation.members.find(m => m.user_id !== this.currentUser()?.id);
      if (otherMember?.user) {
        return this.friendshipService.getUserInitials(otherMember.user);
      }
    }
    return conversation.name?.substring(0, 2).toUpperCase() || 'GP';
  }

  public getLastMessagePreview(conversation: IConversation): string {
    // Si la conversación tiene mensajes cargados, usar el último
    const messages = this.conversationService.messages();
    const conversationMessages = messages.filter(msg => msg.conversation_id === conversation.id);
    
    if (conversationMessages.length > 0) {
      const lastMessage = conversationMessages[conversationMessages.length - 1];
      return this.formatMessagePreview(lastMessage);
    }

    // Si no hay mensajes cargados pero la conversación tiene información del último mensaje
    // (necesitarías agregar esta propiedad a tu interfaz IConversation)
    if ((conversation as any).last_message) {
      return this.formatMessagePreview((conversation as any).last_message);
    }

    // Mensaje por defecto basado en el tipo de conversación
    if (conversation.type === 'direct') {
      return 'Inicia una conversación';
    } else {
      return 'Grupo creado';
    }
  }

  private formatMessagePreview(message: IMessage): string {
    if (!message) return '';

    const senderPrefix = message.sender_id === this.currentUser()?.id ? 'Tú: ' : '';

    switch (message.message_type) {
      case EMessageType.text:
        return senderPrefix + (message.content || 'Mensaje de texto');
      
      case EMessageType.image:
        return senderPrefix + '🖼️ Imagen';
      
      case EMessageType.file:
        return senderPrefix + '📎 Archivo';
      
      case EMessageType.system:
        return message.content || 'Mensaje del sistema';
      
      default:
        return senderPrefix + 'Nuevo mensaje';
    }
  }

  public formatLastActivity(conversation: IConversation): string {
    if (!conversation.last_message_at) return '';
    return this.friendshipService.formatLastSeen(conversation.last_message_at);
  }

  // Manejar cambios en la búsqueda
  public onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  // Limpiar búsqueda
  public clearSearch(): void {
    this.searchQuery.set('');
  }
}