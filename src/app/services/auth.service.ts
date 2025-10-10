// auth.service.ts
import { Injectable, signal, inject, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, tap, finalize, map } from 'rxjs/operators';
import { Observable, of, throwError } from 'rxjs';
import { ConfigService } from './config.service';
import { IUser } from '../types/user';
import { LoginRequest, LoginResponse } from '../types/auth';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly configService = inject(ConfigService);

  // Signals
  isLoading = signal<boolean>(false);
  isLoadingBtn = signal<boolean>(false);
  currentUser = signal<IUser | null>(null);
  error = signal<string | null>(null);

  // Computed signals
  isAuthenticated = computed(() => !!this.currentUser());
  userInitials = computed(() => {
    const user = this.currentUser();
    if (!user?.name) return 'U';
    return user.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase();
  });

  constructor() {
    this.initializeCurrentUser();
  }

  private initializeCurrentUser(): void {
    const savedUser = localStorage.getItem('jfchat_user');
    if (savedUser) {
      try {
        this.currentUser.set(JSON.parse(savedUser));
      } catch {
        this.clearAuthData();
      }
    }
  }

  /**
   * Login de usuario
   */
  public login(credentials: LoginRequest): Observable<LoginResponse> {
    this.isLoadingBtn.set(true);

    const url = this.configService.getApiUrl('/auth/login');

    return this.http.post<LoginResponse>(url, credentials).pipe(
      tap((response) => {
        this.handleLoginSuccess(response);
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
   * Registro de usuario
   */
  public register(userData: any): Observable<LoginResponse> {
    this.isLoadingBtn.set(true);

    const url = this.configService.getApiUrl('/auth/register');

    return this.http.post<LoginResponse>(url, userData).pipe(
      tap(response => {
        this.handleLoginSuccess(response);
      }),
      catchError(error => {
        this.getErrorMessage(error);
        return of(null as any);
      }),
      finalize(() => {
        this.isLoadingBtn.set(false);
      })
    );
  }

  /**
   * Obtener usuario actual desde el backend
   */
  public getCurrentUser(): Observable<IUser> {
    this.isLoading.set(true);

    const url = this.configService.getApiUrl('/auth/current');

    return this.http.get<IUser>(url).pipe(
      tap(user => {
        this.currentUser.set(user);
        localStorage.setItem('jfchat_user', JSON.stringify(user));
      }),
      catchError(error => {
        this.getErrorMessage(error);
        this.clearAuthData();
        return of(null as any);
      }),
      finalize(() => {
        this.isLoading.set(false);
      })
    );
  }

  /**
   * Logout
   */
  public logout(): void {
    this.isLoadingBtn.set(true);
    
    const url = this.configService.getApiUrl('/auth/logout');

    this.http.post(url, {}).pipe(
      finalize(() => {
        this.clearAuthData();
        this.isLoadingBtn.set(false);
        this.router.navigate(['/login']);
      })
    ).subscribe();
  }

  /**
   * Actualizar perfil de usuario
   */
  public updateProfile(userData: Partial<IUser>): Observable<IUser> {
    this.isLoadingBtn.set(true);

    const url = this.configService.getApiUrl('/auth/profile');

    return this.http.patch<IUser>(url, userData).pipe(
      tap(updatedUser => {
        this.currentUser.set(updatedUser);
        localStorage.setItem('jfchat_user', JSON.stringify(updatedUser));
      }),
      catchError(error => {
        this.getErrorMessage(error);
        return of(null as any);
      }),
      finalize(() => {
        this.isLoadingBtn.set(false);
      })
    );
  }

  /**
   * Cambiar contraseña
   */
  public changePassword(passwordData: {
    currentPassword: string;
    newPassword: string;
  }): Observable<void> {
    this.isLoadingBtn.set(true);

    const url = this.configService.getApiUrl('/auth/password');

    return this.http.patch<void>(url, passwordData).pipe(
      catchError(error => {
        this.getErrorMessage(error);
        return of(null as any);
      }),
      finalize(() => {
        this.isLoadingBtn.set(false);
      })
    );
  }

  /**
   * Verificar si el usuario está autenticado
   */
  public checkAuthStatus(): Observable<boolean> {
    this.isLoading.set(true);

    const url = this.configService.getApiUrl('/auth/check');

    return this.http.get<{ authenticated: boolean }>(url).pipe(
      tap(response => {
        if (!response.authenticated) {
          this.clearAuthData();
        }
      }),
      map(response => response.authenticated),
      catchError(() => {
        this.clearAuthData();
        return of(false);
      }),
      finalize(() => {
        this.isLoading.set(false);
      })
    );
  }

  /**
   * Refresh token
   */
  public refreshToken(): Observable<{ token: string; refreshToken: string }> {
    const refreshToken = localStorage.getItem('jfchat_refresh_token');
    const url = this.configService.getApiUrl('/auth/refresh');

    return this.http.post<{ token: string; refreshToken: string }>(url, {
      refreshToken
    }).pipe(
      tap(tokens => {
        localStorage.setItem('jfchat_token', tokens.token);
        localStorage.setItem('jfchat_refresh_token', tokens.refreshToken);
      }),
      catchError(error => {
        this.clearAuthData();
        return throwError(() => error);
      })
    );
  }

  private handleLoginSuccess(response: LoginResponse): void {
    this.currentUser.set(response.user);
    
    // Guardar en localStorage
    localStorage.setItem('jfchat_user', JSON.stringify(response.user));
    localStorage.setItem('jfchat_token', response.accesToken);
    localStorage.setItem('jfchat_refresh_token', response.refreshToken);
    
    this.router.navigate(['/chat']);
  }

  private clearAuthData(): void {
    this.currentUser.set(null);
    localStorage.removeItem('jfchat_user');
    localStorage.removeItem('jfchat_token');
    localStorage.removeItem('jfchat_refresh_token');
  }

  private getErrorMessage(error: any): string {
    if (error.status === 401) {
      return $localize`No tienes autorización`;
    } else if (error.status === 404) {
      return $localize`Usuario o contraseña invalido`;
    } else if (error.status >= 500) {
      return $localize`Error del servidor, intenta más tarde`;
    } else {
      return error.error?.message || $localize`Error de conexión`;
    }
  }

  // Métodos auxiliares para obtener el estado actual
  public getCurrentUserValue(): IUser | null {
    return this.currentUser();
  }

  public getIsLoading(): boolean {
    return this.isLoading();
  }

  public getIsLoadingBtn(): boolean {
    return this.isLoadingBtn();
  }

  public getError(): string | null {
    return this.error();
  }

  clearError(): void {
  }

  // Método para debug (opcional)
  public getCurrentConfig(): { baseUrl: string; production: boolean } {
    return {
      baseUrl: this.configService.getBaseUrl(),
      production: this.configService.isProduction()
    };
  }
}