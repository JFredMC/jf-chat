// chat.service.ts
import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IFriendship } from '../types/friendship.type';
import { catchError, finalize, Observable, tap, throwError } from 'rxjs';
import { ConfigService } from '../../../services/config.service';
import { IUser } from '../../../types/user';
import { ActiveChat } from '../types/active-chat.type';

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
    this.isLoading.set(true);
    this.isLoadingBtn.set(true);

    return this.http.get<IFriendship[]>(this.urlApi).pipe(
      tap((response) => {
        this.friendsSignal.set(response || []);
      }),
      catchError((error) => {
        const errorMessage = this.getErrorMessage(error);
        this.error.set(errorMessage);
        return throwError(() => errorMessage);
      }),
      finalize(() => {
        this.isLoading.set(false);
        this.isLoadingBtn.set(false);
      })
    );
  }

  // Método auxiliar para obtener el usuario amigo (dependiendo de la relación)
  getFriendUser(friendship: IFriendship, currentUserId: number): IUser {
    return friendship.user_id === currentUserId ? friendship.friend : friendship.user;
  }

  // Generar color de avatar basado en el ID del usuario
  generateAvatarColor(userId: number): string {
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

  // Obtener iniciales del usuario
  getUserInitials(user: IUser): string {
    return `${user.first_name?.charAt(0) || ''}${user.last_name?.charAt(0) || ''}`.toUpperCase() || 
           user.username.charAt(0).toUpperCase();
  }

  // Formatear última vez visto
  formatLastSeen(lastSeen: string): string {
    if (!lastSeen) return '';
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    
    return date.toLocaleDateString();
  }

  private getErrorMessage(error: any): string {
    if (error.status === 401) {
      return $localize`No tienes autorización`;
    } else if (error.status === 404) {
      return $localize`Usuarios no encontrados`;
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