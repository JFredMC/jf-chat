import { Component, DestroyRef, inject, signal } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { FriendshipService } from '../../friendship/services/friendship.service';
import { IUser } from '../../../types/user';
import { ConversationService } from '../conversations/services/conversation.service';
import { WebsocketService } from '../../../services/web-socket.service';
import { IMessage } from '../messages/types/message.type';
import { IConversation } from '../conversations/types/conversation.type';
import { MessageBubble } from './components/message-bubble/message-bubble';
import { EMessageType } from '../messages/enum/message-type.enum';
import { EMessageStatuses } from '../messages/enum/message-status.enum';
import { SweetAlertService } from '../../../services/sweet-alert.service';
import { ContactView } from './components/contact-view/contact-view';
import { ChatActions } from './components/chat-actions/chat-actions';

@Component({
  selector: 'app-chat-area',
  templateUrl: './chat-area.html',
  styleUrl: './chat-area.scss',
  imports: [MessageBubble, ContactView, ChatActions],
})
export class ChatArea {
  private readonly conversationService = inject(ConversationService);
  private readonly websocketService = inject(WebsocketService);
  private readonly authService = inject(AuthService);
  private readonly friendshipService = inject(FriendshipService);
  private readonly sweetAlertService = inject(SweetAlertService);
  private readonly destroyRef = inject(DestroyRef);

  // Exponer el servicio como público para el template
  public conversationServicePublic = this.conversationService;
  public activeConversation = this.conversationService.activeConversation;
  public messages = this.conversationService.messages;
  public currentUser = this.authService.currentUser;
  public messageInput = signal<string>('');
  public isTyping = signal<boolean>(false);
  public attachedFiles = signal<File[]>([]);

  // Señales para el menú de opciones
  public isContactViewOpen = signal<boolean>(false);
  public selectedContact = signal<IUser | null>(null);

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

    const messageReadSub = this.websocketService.messageRead.subscribe((data) => {
      this.handleMessageRead(data);
    });

    const conversationReadSub = this.websocketService.conversationRead.subscribe((data) => {
      this.handleConversationRead(data);
    });

    // Limpiar suscripciones
    this.destroyRef.onDestroy(() => {
      newMessageSub.unsubscribe();
      userStatusSub.unsubscribe();
      userJoinedSub.unsubscribe();
      userLeftSub.unsubscribe();
      connectionStatusSub.unsubscribe();
      messageReadSub.unsubscribe();
      conversationReadSub.unsubscribe();
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

  private handleMessageRead(data: {
    messageId: number;
    userId: number;
    readAt: string;
    conversationId: number;
  }): void {
    const activeConv = this.activeConversation();
    
    // Solo procesar si es la conversación activa
    if (activeConv && activeConv.id === data.conversationId) {
      this.messages.update(messages => 
        messages.map(message => {
          if (message.id === data.messageId) {
            const updatedStatuses = [
              ...(message.statuses || []),
              {
                user_id: data.userId,
                status: EMessageStatuses.read,
                read_at: data.readAt
              }
            ];
            return { ...message, statuses: updatedStatuses };
          }
          return message;
        })
      );
    }
  }

  private handleConversationRead(data: {
    conversationId: number;
    userId: number;
    readAt: string;
    unreadCount: number;
  }): void {
    // Actualizar la lista de conversaciones si es necesario
    console.log(`Conversation ${data.conversationId} marked as read by user ${data.userId}`);
  }

  // Marcar mensajes como leídos cuando se cargan o se ven
  markMessagesAsRead(): void {
    const conversation = this.activeConversation();
    const userId = this.currentUser()?.id;
    
    if (conversation && userId) {
      // Marcar toda la conversación como leída
      this.websocketService.markConversationAsRead(conversation.id!);
      
      // También marcar mensajes individuales si es necesario
      this.messages().forEach((message) => {
        if (message.sender_id !== userId && !this.isMessageReadByUser(message, userId)) {
          this.websocketService.markAsRead(message.id!);
        }
      });
    }
  }

  // Verificar si un mensaje fue leído por un usuario específico
  private isMessageReadByUser(message: IMessage, userId: number): boolean {
    return message.statuses?.some(status => 
      status.user_id === userId && status.status === 'read'
    ) || false;
  }

  // Método auxiliar para el template (si lo necesitas)
  isMessageRead(message: IMessage): boolean {
    const userId = this.currentUser()?.id;
    if (!userId) return false;
    
    return this.isMessageReadByUser(message, userId);
  }

  // Llamar este método cuando la conversación se active o se recarguen mensajes
  onConversationActivated(): void {
    this.scrollToBottom();
    setTimeout(() => {
      this.markMessagesAsRead();
    }, 500); // Pequeño delay para asegurar que la UI esté renderizada
  }

  viewContact(): void {
    const conversation = this.activeConversation();
    if (conversation?.type === 'direct') {
      const otherMember = this.getOtherMember(conversation);
      if (otherMember) {
        this.selectedContact.set(otherMember);
        this.isContactViewOpen.set(true);
      }
    }
  }

  closeContactView(): void {
    this.isContactViewOpen.set(false);
    this.selectedContact.set(null);
  }

  // Método llamado cuando se elimina una conversación desde ChatActions
  onConversationDeleted(): void {
    this.conversationService.setActiveConversation(null);
    this.conversationService.getUserConversations().subscribe();
  }

  // Método para enviar mensaje desde la vista de contacto
  onSendMessageFromContact(): void {
    this.closeContactView();
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
