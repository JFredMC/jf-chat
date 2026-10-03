import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../../core/config';
import type { Attachment, Conversation, Message, MessagePage } from '../../core/models';

export interface SendMessageBody {
  content?: string;
  client_id?: string;
  reply_to_id?: number;
  attachment_ids?: number[];
}

@Injectable({ providedIn: 'root' })
export class ChatApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);

  public conversations(): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(`${this.api}/conversation`);
  }

  public conversation(id: number): Observable<Conversation> {
    return this.http.get<Conversation>(`${this.api}/conversation/${id}`);
  }

  public openDirect(friendId: number): Observable<Conversation> {
    return this.http.post<Conversation>(`${this.api}/conversation/direct`, { friendId });
  }

  public messages(conversationId: number, before?: number, limit = 30): Observable<MessagePage> {
    const params: Record<string, string> = { limit: String(limit) };
    if (before) params['before'] = String(before);
    return this.http.get<MessagePage>(`${this.api}/conversation/${conversationId}/messages`, { params });
  }

  public send(conversationId: number, body: SendMessageBody): Observable<Message> {
    return this.http.post<Message>(`${this.api}/conversation/${conversationId}/messages`, body);
  }

  public markRead(conversationId: number, messageId?: number): Observable<{ lastReadMessageId: number }> {
    return this.http.post<{ lastReadMessageId: number }>(`${this.api}/conversation/${conversationId}/read`, messageId ? { messageId } : {});
  }

  public leave(conversationId: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/conversation/${conversationId}`);
  }

  public upload(conversationId: number, file: File): Observable<Attachment> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<Attachment>(`${this.api}/conversation/${conversationId}/attachments`, form);
  }

  public attachmentUrl(id: number): Observable<{ url: string; expiresIn: number }> {
    return this.http.get<{ url: string; expiresIn: number }>(`${this.api}/attachment/${id}/url`);
  }

  public discardAttachment(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/attachment/${id}`);
  }
}
