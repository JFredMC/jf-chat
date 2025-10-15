// websocket.service.ts
import { Injectable, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject } from 'rxjs';
import { ConfigService } from './config.service';
import { ClientToServerEvents, ServerToClientEvents } from '../types/web-socket.type';
import { IMessage } from '../features/chat/messages/types/message.type';


@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private readonly configService = inject(ConfigService);
  private socket!: Socket<ServerToClientEvents, ClientToServerEvents>;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isConnected = false;

  // Subjects para notificar a los componentes
  public newMessage = new Subject<IMessage>();
  public messageRead = new Subject<{messageId: number, userId: number}>();
  public userStatusChange = new Subject<{userId: number, status: string}>();
  public connectionStatus = new Subject<boolean>();
  public userJoined = new Subject<{clientId: string; userId?: number}>();
  public userLeft = new Subject<{clientId: string; userId?: number}>();

  constructor() {
    this.initializeSocket();
  }

  private initializeSocket(): void {
    const wsUrl = this.configService.getWebSocketUrl();

    this.socket = io(wsUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      autoConnect: false,
      secure: this.configService.isProduction(),
      withCredentials: true
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Eventos de conexión
    this.socket.on('connect', () => {
      console.log('Socket.io connected:', this.socket.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.connectionStatus.next(true);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket.io disconnected:', reason);
      this.isConnected = false;
      this.connectionStatus.next(false);
      this.attemptReconnect();
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket.io connection error:', error);
      this.isConnected = false;
      this.connectionStatus.next(false);
    });

    // Eventos de aplicación
    this.socket.on('new_message', (message: IMessage) => {
      console.log('New message received:', message);
      this.newMessage.next(message);
    });

    this.socket.on('message_read', (data: { messageId: number; userId: number }) => {
      this.messageRead.next(data);
    });

    this.socket.on('user_status', (data: { userId: number; status: string }) => {
      this.userStatusChange.next(data);
    });

    this.socket.on('user_joined', (data: { clientId: string; userId?: number }) => {
      this.userJoined.next(data);
    });

    this.socket.on('user_left', (data: { clientId: string; userId?: number }) => {
      this.userLeft.next(data);
    });

    this.socket.on('message_delivered', (data: { status: string; timestamp: Date }) => {
      console.log('Message delivered:', data);
    });
  }

  // Conectar con autenticación
  connect(userId: number, token: string): void {
    if (this.isConnected) {
      console.log('Socket already connected');
      return;
    }

    console.log('Connecting WebSocket with userId:', userId);
    this.socket.auth = { userId, token };
    this.socket.connect();
  }

  // Desconectar
  disconnect(): void {
    this.socket.disconnect();
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * this.reconnectAttempts, 30000);
      
      setTimeout(() => {
        console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.socket.connect();
      }, delay);
    }
  }

  // Enviar mensaje
  sendMessage(message: IMessage): void {
    if (this.isConnected) {
      this.socket.emit('send_message', message);
    } else {
      console.error('Socket not connected');
    }
  }

  // Marcar como leído
  markAsRead(messageId: number, userId: number): void {
    if (this.isConnected) {
      this.socket.emit('mark_read', { messageId, userId });
    }
  }

  // Unirse a una conversación
  joinConversation(conversationId: number): void {
    if (this.isConnected) {
      this.socket.emit('join_conversation', conversationId);
    }
  }

  // Salir de una conversación
  leaveConversation(conversationId: number): void {
    if (this.isConnected) {
      this.socket.emit('leave_conversation', conversationId);
    }
  }

  // Indicar que está escribiendo
  startTyping(conversationId: number, userId: number): void {
    if (this.isConnected) {
      this.socket.emit('typing_start', { conversationId, userId });
    }
  }

  // Indicar que dejó de escribir
  stopTyping(conversationId: number, userId: number): void {
    if (this.isConnected) {
      this.socket.emit('typing_stop', { conversationId, userId });
    }
  }

  // Obtener estado de conexión
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  // Obtener ID del socket
  getSocketId(): string {
    return this.socket.id || '';
  }
}