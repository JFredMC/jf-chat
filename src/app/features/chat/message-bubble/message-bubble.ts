import { Component, inject, input, Input } from '@angular/core';
import { IMessage } from '../messages/types/message.type';
import { IConversation } from '../conversations/types/conversation.type';
import { AuthService } from '../../../services/auth.service';
import { FriendshipService } from '../../friendship/services/friendship.service';
import { IUser } from '../../../types/user';

@Component({
  selector: 'app-message-bubble',
  templateUrl: './message-bubble.html',
  styleUrl: './message-bubble.scss'
})
export class MessageBubble {
  private readonly authService = inject(AuthService);
  private readonly friendshipService = inject(FriendshipService);

  message = input.required<IMessage>();
  isOwn = input.required<boolean>();
  conversation = input<IConversation>();

  // Obtener el usuario actual
  get currentUser(): IUser | null {
    return this.authService.currentUser();
  }

  // Obtener el remitente del mensaje
  getMessageSender(): IUser | null {
    const message = this.message();
    if (message.sender) {
      return message.sender;
    }
    
    // Si no viene el sender completo, buscar en los miembros de la conversación
    const conversation = this.conversation();
    if (conversation?.members && message.sender_id) {
      const member = conversation.members.find(m => m.user_id === message.sender_id);
      return member?.user || null;
    }
    
    return null;
  }

  // Obtener iniciales del remitente
  getSenderInitials(): string {
    const sender = this.getMessageSender();
    if (sender) {
      return this.friendshipService.getUserInitials(sender);
    }
    return '?';
  }

  // Obtener color del avatar del remitente
  getSenderAvatarColor(): string {
    const sender = this.getMessageSender();
    if (sender) {
      return this.friendshipService.generateAvatarColor(sender.id || 0);
    }
    return 'bg-gray-500';
  }

  // Obtener iniciales del usuario actual
  getUserInitials(): string {
    if (this.currentUser) {
      return this.friendshipService.getUserInitials(this.currentUser);
    }
    return 'U';
  }

  // Obtener color del avatar del usuario actual
  getUserAvatarColor(): string {
    if (this.currentUser) {
      return this.friendshipService.generateAvatarColor(this.currentUser.id || 0);
    }
    return 'bg-blue-500';
  }

  // Verificar si el mensaje tiene contenido
  hasContent(): boolean {
    const message = this.message();
    return !!message.content && message.content.trim().length > 0;
  }

  // Formatear la fecha del mensaje
  formatMessageTime(): string {
    const message = this.message();
    if (!message.created_at) return '';
    
    const date = new Date(message.created_at);
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  // Verificar si es un mensaje de sistema
  isSystemMessage(): boolean {
    return this.message().message_type === 'system';
  }

  // Verificar si es un mensaje de archivo
  isFileMessage(): boolean {
    return this.message().message_type === 'file';
  }

  // Verificar si es un mensaje de imagen
  isImageMessage(): boolean {
    return this.message().message_type === 'image';
  }

  hasDeliveredStatus(): boolean {
    const statuses = this.message()?.statuses;
    return Array.isArray(statuses) && statuses.some(s => s?.status === 'delivered');
  }

  hasReadStatus(): boolean {
    const statuses = this.message()?.statuses;
    return Array.isArray(statuses) && statuses.some(s => s?.status === 'read');
  }

  hasOnlySentStatus(): boolean {
    const statuses = this.message()?.statuses;
    return !Array.isArray(statuses) || statuses.every(s => s?.status === 'sent');
  }
}