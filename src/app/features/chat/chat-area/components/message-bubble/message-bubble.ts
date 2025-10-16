import { Component, inject, input } from '@angular/core';
import { AuthService } from '../../../../../services/auth.service';
import { FriendshipService } from '../../../../friendship/services/friendship.service';
import { IMessage } from '../../../messages/types/message.type';
import { IConversation } from '../../../conversations/types/conversation.type';
import { IUser } from '../../../../../types/user';


@Component({
  selector: 'app-message-bubble',
  templateUrl: './message-bubble.html',
  styleUrl: './message-bubble.scss'
})
export class MessageBubble {
  private readonly authService = inject(AuthService);
  private readonly friendshipService = inject(FriendshipService);

  public message = input.required<IMessage>();
  public isOwn = input.required<boolean>();
  public conversation = input<IConversation>();

  private get currentUser(): IUser | null {
    return this.authService.currentUser();
  }

  public getMessageSender(): IUser | null {
    const message = this.message();
    if (message.sender) {
      return message.sender;
    }
    
    const conversation = this.conversation();
    if (conversation?.members && message.sender_id) {
      const member = conversation.members.find(m => m.user_id === message.sender_id);
      return member?.user || null;
    }
    
    return null;
  }

  public getSenderInitials(): string {
    const sender = this.getMessageSender();
    if (sender) {
      return this.friendshipService.getUserInitials(sender);
    }
    return '?';
  }

  public getSenderAvatarColor(): string {
    const sender = this.getMessageSender();
    if (sender) {
      return this.friendshipService.generateAvatarColor(sender.id || 0);
    }
    return 'bg-gray-500';
  }

  public getUserInitials(): string {
    if (this.currentUser) {
      return this.friendshipService.getUserInitials(this.currentUser);
    }
    return 'U';
  }

  public getUserAvatarColor(): string {
    if (this.currentUser) {
      return this.friendshipService.generateAvatarColor(this.currentUser.id || 0);
    }
    return 'bg-blue-500';
  }

  public hasContent(): boolean {
    const message = this.message();
    return !!message.content && message.content.trim().length > 0;
  }

  public formatMessageTime(): string {
    const message = this.message();
    if (!message.created_at) return '';
    
    const date = new Date(message.created_at);
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  public isSystemMessage(): boolean {
    return this.message().message_type === 'system';
  }

  public isFileMessage(): boolean {
    return this.message().message_type === 'file';
  }

  public isImageMessage(): boolean {
    return this.message().message_type === 'image';
  }

  public hasDeliveredStatus(): boolean {
    const statuses = this.message()?.statuses;
    return Array.isArray(statuses) && statuses.some(s => s?.status === 'delivered');
  }

  public hasReadStatus(): boolean {
    const statuses = this.message()?.statuses;
    const currentUserId = this.currentUser?.id;
    
    return Array.isArray(statuses) && 
           statuses.some(s => s?.status === 'read' && s.user_id === currentUserId);
  }

  public hasOnlySentStatus(): boolean {
    const statuses = this.message()?.statuses;
    return !Array.isArray(statuses) || statuses.length === 0 || 
           statuses.every(s => s?.status === 'sent');
  }
}