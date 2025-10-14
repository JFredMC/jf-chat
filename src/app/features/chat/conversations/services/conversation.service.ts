import { HttpClient } from "@angular/common/http";
import { inject, Injectable, signal } from "@angular/core";
import { ConfigService } from "../../../../services/config.service";
import { IConversation } from "../types/conversation.type";
import { IMessage } from "../../messages/types/message.type";
import { finalize, Observable, tap } from "rxjs";

// conversation.service.ts
@Injectable({
  providedIn: 'root'
})
export class ConversationService {
  private readonly http = inject(HttpClient);
  private readonly configService = inject(ConfigService);
  private readonly urlApi = this.configService.getApiUrl('/conversation');

  // Signals
  public conversations = signal<IConversation[]>([]);
  public activeConversation = signal<IConversation | null>(null);
  public messages = signal<IMessage[]>([]);
  public isLoading = signal<boolean>(false);
  
  // Cargar conversaciones del usuario
  getUserConversations(): Observable<IConversation[]> {
    this.isLoading.set(true);
    return this.http.get<IConversation[]>(`${this.urlApi}/by-user`).pipe(
      tap(conversations => {
        this.conversations.set(conversations);
      }),
      finalize(() => this.isLoading.set(false))
    );
  }

  // Crear o obtener conversación directa
  getOrCreateDirectConversation(friendId: number): Observable<IConversation> {
    this.isLoading.set(true);
    return this.http.post<IConversation>(`${this.urlApi}/direct`, { friendId }).pipe(
      tap(conversation => {
        // Añadir la nueva conversación a la lista
        this.conversations.update(convs => {
          const exists = convs.some(c => c.id === conversation.id);
          return exists ? convs : [...convs, conversation];
        });
        this.activeConversation.set(conversation);
      }),
      finalize(() => this.isLoading.set(false))
    );
  }

  // Cargar mensajes de una conversación
  getMessages(conversationId: number): Observable<IMessage[]> {
    return this.http.get<IMessage[]>(`${this.urlApi}/obtain-messages/${conversationId}`).pipe(
      tap(messages => this.messages.set(messages))
    );
  }

  // Enviar mensaje
  sendMessage(conversationId: number, data: IMessage): Observable<IMessage> {
    return this.http.post<IMessage>(`${this.urlApi}/create-message/${conversationId}`, data );
  }

  // Establecer conversación activa
  setActiveConversation(conversation: IConversation | null): void {
    this.activeConversation.set(conversation);
    if (conversation) {
      this.getMessages(conversation.id!).subscribe();
    } else {
      this.messages.set([]);
    }
  }
}