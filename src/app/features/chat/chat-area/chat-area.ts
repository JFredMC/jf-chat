import { Component, inject, signal } from '@angular/core';
import { ChatService } from '../services/chat.service';
import { AuthService } from '../../../services/auth.service';
import { FriendshipService } from '../../friendship/services/friendship.service';
import { IUser } from '../../../types/user';
import { ConversationService } from '../conversations/services/conversation.service';
import { WebsocketService } from '../../../services/web-socket.service';
import { IMessage } from '../messages/types/message.type';
import { IConversation } from '../conversations/types/conversation.type';
import { MessageBubble } from '../message-bubble/message-bubble';
import { EMessageType } from '../messages/enum/message-type.enum';

@Component({
  selector: 'app-chat-area',
  templateUrl: './chat-area.html',
  styleUrl: './chat-area.scss',
  imports: [MessageBubble],
})
export class ChatArea {
  private readonly conversationService = inject(ConversationService);
  private readonly websocketService = inject(WebsocketService);
  private readonly authService = inject(AuthService);
  private readonly friendshipService = inject(FriendshipService);

  // Exponer el servicio como público para el template
  public conversationServicePublic = this.conversationService;
  public activeConversation = this.conversationService.activeConversation;
  public messages = this.conversationService.messages;
  public currentUser = this.authService.currentUser;
  public messageInput = signal<string>('');
  public isTyping = signal<boolean>(false);
  public attachedFiles = signal<File[]>([]);

  constructor() {
    // Suscribirse a nuevos mensajes via WebSocket
    this.websocketService.newMessage.subscribe((message: IMessage) => {
      if (message.conversation_id === this.activeConversation()?.id) {
        this.messages.update(messages => [...messages, message]);
      }
    });

    // Suscribirse a cambios de estado de usuarios
    this.websocketService.userStatusChange.subscribe((data) => {
      // Actualizar estado de usuarios en la conversación
      this.updateUserStatus(data.userId, data.status);
    });
  }

  // Cargar mensajes de la conversación
  loadMessages(conversationId: number): void {
    this.conversationService.getMessages(conversationId).subscribe({
      next: () => {
        this.scrollToBottom();
        this.markMessagesAsRead();
      },
      error: (error) => {
        console.error('Error al cargar mensajes:', error);
      }
    });
  }

  // Scroll al final de los mensajes
  scrollToBottom(): void {
    setTimeout(() => {
      const messageContainer = document.querySelector('#message-container');
      if (messageContainer) {
        messageContainer.scrollTop = messageContainer.scrollHeight;
      }
    }, 100);
  }

  // Método para actualizar el estado de un usuario en la conversación
  updateUserStatus(userId: number, status: string): void {
    const conversation = this.activeConversation();
    if (conversation && conversation.members) {
      // Encontrar el miembro y actualizar su estado
      const updatedMembers = conversation.members.map(member => {
        if (member.user_id === userId && member.user) {
          return {
            ...member,
            user: {
              ...member.user,
              status: status
            }
          };
        }
        return member;
      });
      
      // Actualizar la conversación
      this.conversationService.activeConversation.set({
        ...conversation,
        members: updatedMembers
      });
    }
  }

  // Obtener el otro miembro en una conversación directa
  getOtherMember(conversation: IConversation): IUser | null {
    if (conversation.type === 'direct' && conversation.members) {
      const currentUserId = this.currentUser()?.id;
      const otherMember = conversation.members.find(m => m.user_id !== currentUserId);
      return otherMember?.user || null;
    }
    return null;
  }

  // Obtener el nombre para mostrar de la conversación
  getConversationDisplayName(conversation: IConversation): string {
    if (conversation.type === 'direct') {
      const otherMember = this.getOtherMember(conversation);
      if (otherMember) {
        return this.getContactDisplayName(otherMember);
      }
      return 'Usuario desconocido';
    } else {
      return conversation.name || 'Grupo sin nombre';
    }
  }

  // Enviar mensaje con soporte para archivos
  async onSendMessage(): Promise<void> {
    const message = this.messageInput().trim();
    const conversation = this.activeConversation();
    
    if ((message || this.attachedFiles().length > 0) && conversation) {
      try {
        // Si hay archivos, subirlos primero
        let attachmentUrls: string[] = [];
        if (this.attachedFiles().length > 0) {
          attachmentUrls = await this.uploadFiles(this.attachedFiles());
        }

        const sendMessageData: IMessage = {
          conversation_id: conversation.id,
          sender_id: this.currentUser()?.id,
          content: message,
          message_type: this.attachedFiles().length > 0 ? EMessageType.file : EMessageType.text,
        }

        // Enviar mensaje
        this.conversationService.sendMessage(
          conversation.id!, 
          sendMessageData
        ).subscribe({
          next: (newMessage) => {
            // El WebSocket se encargará de añadirlo a la lista
            this.messageInput.set('');
            this.attachedFiles.set([]);
          },
          error: (error) => {
            console.error('Error al enviar mensaje:', error);
          }
        });

      } catch (error) {
        console.error('Error al enviar mensaje:', error);
      }
    }
  }

  // Subir archivos
  private async uploadFiles(files: File[]): Promise<string[]> {
    const uploadPromises = files.map(file => this.uploadFile(file));
    return await Promise.all(uploadPromises);
  }

  private uploadFile(file: File): Promise<string> {
    // Implementar subida de archivos
    return Promise.resolve(`/uploads/${file.name}`);
  }

  // Manejar archivos adjuntos
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.attachedFiles.update(files => [...files, ...Array.from(input.files!)]);
    }
  }

  // Remover archivo adjunto
  removeAttachedFile(index: number): void {
    this.attachedFiles.update(files => files.filter((_, i) => i !== index));
  }

  // Marcar mensajes como leídos
  markMessagesAsRead(): void {
    const conversation = this.activeConversation();
    const userId = this.currentUser()?.id;
    
    if (conversation && userId) {
      this.messages().forEach((message) => {
        if (message.sender_id !== userId && !this.isMessageRead(message)) {
          this.websocketService.markAsRead(message.id!, userId);
        }
      });
    }
  }

  // Verificar si mensaje fue leído
  isMessageRead(message: IMessage): boolean {
    // Implementar lógica basada en message_status
    return false;
  }

  // Métodos auxiliares para el template
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

  getUserInitials(user: IUser): string {
    return this.friendshipService.getUserInitials(user);
  }

  getUserAvatarColor(user: IUser): string {
    return this.friendshipService.generateAvatarColor(user.id || 0);
  }

  onInputChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.messageInput.set(input.value);
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSendMessage();
    }
  }
}
