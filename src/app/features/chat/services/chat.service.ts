// chat.service.ts
import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ConfigService } from '../../../services/config.service';

export interface ActiveChat {
  friendId: string;
  friendName: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly configService = inject(ConfigService);
  private readonly urlApi = this.configService.getApiUrl('/chats');

  public isLoading = signal<boolean>(false);
  public isLoadingBtn = signal<boolean>(false);
  public error = signal<string | null>(null);
  
  // Usando señales para estado reactivo (como en tu código)
  activeChat = signal<ActiveChat | null>(null);

  setActiveChat(chat: ActiveChat | null) {
    this.activeChat.set(chat);
  }
}