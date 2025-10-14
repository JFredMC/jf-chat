import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { ConfigService } from './config.service';
import { IMessage } from '../features/chat/messages/types/message.type';


@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private readonly configService = inject(ConfigService);
  private socket: WebSocket | null = null;
  private readonly url = this.configService.getApiUrl('/chat');
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  // Usamos Subject en lugar de output
  public newMessage = new Subject<IMessage>();
  public messageRead = new Subject<{messageId: number, userId: number}>();
  public userStatusChange = new Subject<{userId: number, status: string}>();
  public connectionStatus = new Subject<boolean>();

  connect(userId: number): void {
    try {
      this.socket = new WebSocket(`${this.url}?userId=${userId}`);

      this.socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleIncomingMessage(data);
      };

      this.socket.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.connectionStatus.next(true);
      };

      this.socket.onclose = () => {
        console.log('WebSocket disconnected');
        this.connectionStatus.next(false);
        this.attemptReconnect(userId);
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('Error connecting WebSocket:', error);
    }
  }

  private attemptReconnect(userId: number): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * this.reconnectAttempts, 30000); // Exponential backoff max 30s
      
      setTimeout(() => {
        console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect(userId);
      }, delay);
    }
  }

  private handleIncomingMessage(data: any): void {
    switch (data.type) {
      case 'new_message':
        this.newMessage.next(data.message);
        break;
      case 'message_read':
        this.messageRead.next(data);
        break;
      case 'user_status':
        this.userStatusChange.next(data);
        break;
    }
  }

  sendMessage(message: IMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'send_message',
        message
      }));
    }
  }

  markAsRead(messageId: number, userId: number): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'mark_read',
        messageId,
        userId
      }));
    }
  }
}