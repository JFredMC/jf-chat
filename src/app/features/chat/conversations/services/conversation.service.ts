import { HttpClient } from "@angular/common/http";
import { inject, Injectable, signal } from "@angular/core";
import { ConfigService } from "../../../../services/config.service";
import { IConversation } from "../types/conversation.type";
import { IMessage } from "../../messages/types/message.type";
import { finalize, Observable, tap } from "rxjs";

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
  
  // Mapa para almacenar mensajes por conversación
  private messagesByConversation = new Map<number, IMessage[]>();

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

  // Cargar mensajes de una conversación (solo para carga inicial)
  getMessages(conversationId: number): Observable<IMessage[]> {
    return this.http.get<IMessage[]>(`${this.urlApi}/obtain-messages/${conversationId}`).pipe(
      tap(messages => {
        // Almacenar mensajes en el mapa
        this.messagesByConversation.set(conversationId, messages);
        // Actualizar la señal de mensajes activos
        this.messages.set(messages);
      })
    );
  }

  // Obtener mensajes de una conversación específica
  getMessagesForConversation(conversationId: number): IMessage[] {
    return this.messagesByConversation.get(conversationId) || [];
  }

  // NOTA: EL MÉTODO sendMessage HTTP SE ELIMINA - ahora se usa WebSocket

  // Establecer conversación activa
  setActiveConversation(conversation: IConversation | null): void {
    this.activeConversation.set(conversation);
    if (conversation) {
      this.getMessages(conversation.id!).subscribe();
    } else {
      this.messages.set([]);
    }
  }

  // Actualizar una conversación en la lista
  updateConversation(updatedConversation: IConversation): void {
    this.conversations.update(conversations => 
      conversations.map(conv => 
        conv.id === updatedConversation.id ? updatedConversation : conv
      )
    );
  }

  // Añadir mensaje a una conversación y actualizar last_message_at
  addMessageToConversation(conversationId: number, message: IMessage): void {
    // Actualizar mensajes de la conversación activa
    if (this.activeConversation()?.id === conversationId) {
      this.messages.update(messages => [...messages, message]);
    }

    // Actualizar mensajes en el mapa
    const currentMessages = this.messagesByConversation.get(conversationId) || [];
    this.messagesByConversation.set(conversationId, [...currentMessages, message]);

    // Actualizar la conversación en la lista
    this.conversations.update(conversations => 
      conversations.map(conv => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            last_message_at: message.created_at || new Date().toISOString()
          };
        }
        return conv;
      })
    );
  }

  // Mover conversación al principio de la lista
  moveConversationToTop(conversationId: number): void {
    this.conversations.update(conversations => {
      const conversation = conversations.find(c => c.id === conversationId);
      if (!conversation) return conversations;

      const filtered = conversations.filter(c => c.id !== conversationId);
      return [conversation, ...filtered];
    });
  }

  deleteConversation(conversationId: number): Observable<void> {
    return this.http.delete<void>(`${this.urlApi}/${conversationId}`).pipe(
      tap(() => {
        this.conversations.update(convs => convs.filter(c => c.id !== conversationId));
        if (this.activeConversation()?.id === conversationId) {
          this.activeConversation.set(null);
        }
      })
    );
  }
}