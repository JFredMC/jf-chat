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

  // Usamos Subject en lugar de output
  public newMessage = new Subject<IMessage>();
  public messageRead = new Subject<{messageId: number, userId: number}>();
  public userStatusChange = new Subject<{userId: number, status: string}>();

  connect(userId: number): void {
    this.socket = new WebSocket(`${this.url}?userId=${userId}`);

    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleIncomingMessage(data);
    };

    this.socket.onopen = () => {
      console.log('WebSocket connected');
    };
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