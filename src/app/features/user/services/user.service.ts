import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { IUser } from '../../../types/user';
import { catchError, finalize, Observable, tap, throwError } from 'rxjs';
import { ConfigService } from '../../../services/config.service';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly configService = inject(ConfigService);

  // Signals
  isLoading = signal<boolean>(false);
  isLoadingBtn = signal<boolean>(false);
  error = signal<string | null>(null);
  
  // Computed signals
  public userInitials = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return 'U';
    
    const firstInitial = user.first_name?.[0] || '';
    const lastInitial = user.last_name?.[0] || '';
    
    if (firstInitial && lastInitial) {
      return (firstInitial + lastInitial).toUpperCase();
    } else if (user.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    
    return 'U';
  });

  // Generar color aleatorio basado en las iniciales para consistencia
  public userAvatarColor = computed(() => {
    const initials = this.userInitials();
    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
    ];
    
    if (!initials) return colors[0];
    
    // Generar índice basado en las iniciales para consistencia
    let hash = 0;
    for (let i = 0; i < initials.length; i++) {
      hash = initials.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    
    return colors[index];
  });

  /**
   * Obtener todos los usuarios
  */
  public getAll(): Observable<IUser[]> {
    this.isLoadingBtn.set(true);

    const url = this.configService.getApiUrl('/user');

    return this.http.get<IUser[]>(url).pipe(
      tap((response) => {
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

  /**
   * Registrar usuario
  */
  public register(user: IUser): Observable<IUser> {
    this.isLoadingBtn.set(true);

    const url = this.configService.getApiUrl('/user');

    return this.http.post<IUser>(url, user).pipe(
      tap((response) => {
        console.log('register response: ', response);
        return response;
      }),
      catchError((error) => {
        console.log('register error: ', error);
        const errorMessage = this.getErrorMessage(error);
        return throwError(() => errorMessage);
      }),
      finalize(() => {
        this.isLoadingBtn.set(false);
      })
    );
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
}