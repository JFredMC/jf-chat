import { Component, inject } from '@angular/core';
import { ChatService } from '../services/chat.service';

@Component({
  selector: 'app-chat-area',
  imports: [],
  templateUrl: './chat-area.html',
  styleUrl: './chat-area.scss'
})
export class ChatArea {
  chatService = inject(ChatService);
  activeChat = this.chatService.activeChat; 
}
