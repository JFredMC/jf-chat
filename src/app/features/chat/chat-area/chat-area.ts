import { Component, DestroyRef, inject, signal } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { FriendshipService } from '../../friendship/services/friendship.service';
import { IUser } from '../../../types/user';
import { ConversationService } from '../conversations/services/conversation.service';
import { WebsocketService } from '../../../services/web-socket.service';
import { IMessage } from '../messages/types/message.type';
import { IConversation } from '../conversations/types/conversation.type';
import { MessageBubble } from '../message-bubble/message-bubble';
import { EMessageType } from '../messages/enum/message-type.enum';

// chat-area.ts
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
  private readonly destroyRef = inject(DestroyRef);

  // Exponer el servicio como público para el template
  public conversationServicePublic = this.conversationService;
  public activeConversation = this.conversationService.activeConversation;
  public messages = this.conversationService.messages;
  public currentUser = this.authService.currentUser;
  public messageInput = signal<string>('');
  public isTyping = signal<boolean>(false);
  public attachedFiles = signal<File[]>([]);

  constructor() {
    this.setupWebSocketConnection();
  }

  private setupWebSocketConnection(): void {
    const userId = this.currentUser()?.id;
    const token = this.authService.getToken();
    console.log('Setting up WebSocket connection with userId:', userId, 'and token:', token);

    if (userId && token) {
      this.websocketService.connect(userId, token);
    }

    this.setupWebSocketListeners();
  }

  private setupWebSocketListeners(): void {
    // Suscribirse a nuevos mensajes
    const newMessageSub = this.websocketService.newMessage.subscribe((message: IMessage) => {
      this.handleNewMessage(message);
    });

    // Suscribirse a cambios de estado de usuarios
    const userStatusSub = this.websocketService.userStatusChange.subscribe((data) => {
      this.updateUserStatus(data.userId, data.status);
    });

    // Suscribirse a usuarios uniéndose/saliendo
    const userJoinedSub = this.websocketService.userJoined.subscribe((data) => {
      console.log('User joined:', data);
    });

    const userLeftSub = this.websocketService.userLeft.subscribe((data) => {
      console.log('User left:', data);
    });

    // Suscribirse a errores de conexión
    const connectionStatusSub = this.websocketService.connectionStatus.subscribe((isConnected) => {
      if (!isConnected) {
        console.warn('WebSocket disconnected');
      }
    });

    // Limpiar suscripciones
    this.destroyRef.onDestroy(() => {
      newMessageSub.unsubscribe();
      userStatusSub.unsubscribe();
      userJoinedSub.unsubscribe();
      userLeftSub.unsubscribe();
      connectionStatusSub.unsubscribe();
    });
  }

  // Cuando se selecciona una conversación
  onConversationSelected(conversation: IConversation): void {
    if (conversation.id) {
      this.websocketService.joinConversation(conversation.id);
    }
  }

  private handleNewMessage(message: IMessage): void {
    const activeConv = this.activeConversation();
    
    // Si el mensaje es para la conversación activa, añadirlo
    if (activeConv && message.conversation_id === activeConv.id) {
      this.conversationService.addMessageToConversation(activeConv.id!, message);
      this.scrollToBottom();
      this.markMessagesAsRead();
    }
    
    // Actualizar la conversación en la lista (mover al top y actualizar last_message_at)
    this.conversationService.moveConversationToTop(message.conversation_id!);
  }

  // Enviar mensaje con soporte para archivos - AHORA SOLO POR WEBSOCKET
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
          // Si tienes campo para attachments, agrégalo aquí
          // attachments: attachmentUrls
        };

        // Enviar mensaje SOLO por WebSocket - el backend se encarga de guardar en BD
        this.websocketService.sendMessage(sendMessageData);

        // Limpiar el input y archivos inmediatamente para mejor UX
        this.messageInput.set('');
        this.attachedFiles.set([]);

        // NOTA: El mensaje se añadirá automáticamente cuando llegue del servidor
        // via WebSocket, por lo que NO necesitamos añadirlo localmente

      } catch (error) {
        console.error('Error al enviar mensaje:', error);
        // Aquí podrías mostrar un mensaje de error al usuario
      }
    }
  }

  // Scroll al final de los mensajes
  scrollToBottom(): void {
    setTimeout(() => {
      const messageContainer = document.getElementById('message-container');
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

  // Resto de los métodos permanecen igual...
  getOtherMember(conversation: IConversation): IUser | null {
    if (conversation.type === 'direct' && conversation.members) {
      const currentUserId = this.currentUser()?.id;
      const otherMember = conversation.members.find(m => m.user_id !== currentUserId);
      return otherMember?.user || null;
    }
    return null;
  }

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

  // Subir archivos
  private async uploadFiles(files: File[]): Promise<string[]> {
    const uploadPromises = files.map(file => this.uploadFile(file));
    return await Promise.all(uploadPromises);
  }

  private uploadFile(file: File): Promise<string> {
    // TODO: Implementar subida real de archivos
    // Por ahora retornamos una URL temporal
    console.log('Subiendo archivo:', file.name);
    return Promise.resolve(`/uploads/${Date.now()}_${file.name}`);
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
