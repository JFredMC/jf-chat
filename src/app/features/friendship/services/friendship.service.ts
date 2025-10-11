// chat.service.ts
import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IFriendship } from '../types/friendship.type';
import { catchError, finalize, Observable, tap, throwError } from 'rxjs';
import { ConfigService } from '../../../services/config.service';

export interface ActiveChat {
  friendId: string;
  friendName: string;
}

@Injectable({
  providedIn: 'root'
})
export class FriendshipService {
  private readonly http = inject(HttpClient);
  private readonly configService = inject(ConfigService);
  private readonly urlApi = this.configService.getApiUrl('/friendship');
  
  // Signals
  public activeChat = signal<ActiveChat | null>(null);
  private friendsSignal = signal<IFriendship[]>([]);
  public friends = this.friendsSignal.asReadonly();
  public isLoading = signal<boolean>(false);
  public isLoadingBtn = signal<boolean>(false);
  public error = signal<string | null>(null);
  
  public getAll(): Observable<IFriendship[]> {
    this.isLoadingBtn.set(true);

    return this.http.get<IFriendship[]>(this.urlApi).pipe(
      tap((response) => {
         this.friendsSignal.set(this.mapFriends(response || []));
        return response;
      }),
      catchError((error) => {
        const errorMessage = this.getErrorMessage(error);
        return throwError(() => errorMessage);
      }),
      finalize(() => {
        this.isLoadingBtn.set(false);
      })
    );
  }

  private mapFriends(friendsData: any[]): IFriendship[] {
    return friendsData.map(friend => ({
      id: friend.id.toString(),
      name: `${friend.first_name} ${friend.last_name}`,
      username: friend.username,
      avatar_url: friend.avatar_url,
      initials: `${friend.first_name?.charAt(0) || ''}${friend.last_name?.charAt(0) || ''}`.toUpperCase(),
      avatarColor: this.generateAvatarColor(friend.id),
      is_online: friend.is_online || false,
      last_seen: this.formatLastSeen(friend.last_seen)
    }));
  }

  private generateAvatarColor(userId: number): string {
    const colors = [
      'bg-gradient-to-br from-blue-500 to-blue-600',
      'bg-gradient-to-br from-green-500 to-green-600',
      'bg-gradient-to-br from-purple-500 to-purple-600',
      'bg-gradient-to-br from-red-500 to-red-600',
      'bg-gradient-to-br from-yellow-500 to-yellow-600',
      'bg-gradient-to-br from-indigo-500 to-indigo-600',
      'bg-gradient-to-br from-pink-500 to-pink-600'
    ];
    return colors[userId % colors.length];
  }

  private formatLastSeen(lastSeen: string): string {
    if (!lastSeen) return '';
    return new Date(lastSeen).toLocaleDateString();
  }


  private getErrorMessage(error: any): string {
    if (error.status === 401) {
      return $localize`No tienes autorización`;
    } else if (error.status === 404) {
      return $localize`Usuarios`;
    } else if (error.status >= 500) {
      return $localize`Error del servidor, intenta más tarde`;
    } else {
      return error.error?.message || $localize`Error de conexión`;
    }
  }
  
  setActiveChat(chat: ActiveChat | null) {
    this.activeChat.set(chat);
  }
}