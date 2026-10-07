import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, firstValueFrom, map, of, shareReplay, tap, throwError } from 'rxjs';
import { API_URL } from '../config';
import type { AuthSession, RegisterRequest, User } from '../models';
import { type VaultKey, deriveKey, isVaulted, seal, unlock } from './session-vault';

const REFRESH_KEY = 'velo.session';
/** Key used before the Velo rename; migrated once and removed. */
const LEGACY_REFRESH_KEY = 'jfchat.refresh';

/** There is no refresh token to use. */
export class NoSessionError extends Error {
  public constructor() {
    super('Sin sesión');
  }
}

/** True when the server rejected the session (not a network or server error). */
export function isSessionRejected(error: unknown): boolean {
  if (error instanceof NoSessionError) return true;
  return error instanceof HttpErrorResponse && [400, 401, 403].includes(error.status);
}

/**
 * Session state.
 *
 * - The access token (15 min) lives **only in memory**.
 * - The refresh token (rotating, 30 days) is kept in localStorage so the
 *   session survives reloads; every use returns a new one.
 * - Refreshes are single-flight: concurrent 401s share one request.
 * - Logging out in one tab logs out every tab (storage event).
 * - With a PIN, the stored refresh token is sealed (AES-GCM, key derived from
 *   the PIN) and the plain token only lives in memory once unlocked.
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly api = inject(API_URL);

  private readonly currentUser = signal<User | null>(null);
  private accessToken: string | null = null;
  private refreshInFlight: Observable<string> | null = null;
  /** PIN-derived key and the decrypted refresh token (memory only). */
  private vault: VaultKey | null = null;
  private memoryRefresh: string | null = null;

  public readonly user = this.currentUser.asReadonly();
  /** The device keeps a PIN-sealed session (reactive view of hasPin()). */
  public readonly pinEnabled = signal(this.hasPin());
  public readonly isAuthenticated = computed(() => this.currentUser() !== null);

  public constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === REFRESH_KEY && event.newValue === null && this.currentUser()) {
          this.clear();
          void this.router.navigate(['/auth/login']);
        }
      });
    }
  }

  public token(): string | null {
    return this.accessToken;
  }

  /** On startup: resume the session if there is a (not sealed) refresh token. */
  public async restore(): Promise<void> {
    if (!this.storedRefreshToken()) return;
    await this.resume();
  }

  /** True when the device keeps a PIN-sealed session. */
  public hasPin(): boolean {
    return isVaulted(this.rawStored());
  }

  /**
   * Opens the sealed session with the PIN. Resumes the session when it was not
   * active yet (app start). Returns false for a wrong PIN.
   */
  public async unlockWithPin(pin: string): Promise<boolean> {
    const raw = this.rawStored();
    if (!isVaulted(raw)) return false;
    const opened = await unlock(pin, raw);
    if (!opened) return false;
    this.vault = opened.vault;
    if (!this.currentUser()) {
      this.memoryRefresh = opened.secret;
      await this.resume();
    }
    return true;
  }

  /** Seals the current session with a new PIN. */
  public async enablePin(pin: string): Promise<void> {
    const token = this.storedRefreshToken();
    if (!token) throw new NoSessionError();
    const vault = await deriveKey(pin);
    this.write(await seal(vault, token));
    this.vault = vault;
    this.memoryRefresh = token;
  }

  /** Removes the PIN (the session is stored in clear again). */
  public async disablePin(pin: string): Promise<boolean> {
    const raw = this.rawStored();
    if (!isVaulted(raw)) return true;
    const opened = await unlock(pin, raw);
    if (!opened) return false;
    this.vault = null;
    this.memoryRefresh = null;
    this.write(this.currentUser() ? opened.secret : null);
    return true;
  }

  private async resume(): Promise<void> {
    await firstValueFrom(this.refresh().pipe(catchError(() => of(null))));
  }

  public login(username: string, password: string): Observable<User> {
    return this.http
      .post<AuthSession>(`${this.api}/auth/login`, { username, password })
      .pipe(map((session) => this.apply(session)));
  }

  public register(request: RegisterRequest): Observable<User> {
    return this.http.post<AuthSession>(`${this.api}/auth/register`, request).pipe(map((session) => this.apply(session)));
  }

  public isUsernameAvailable(username: string): Observable<boolean> {
    return this.http
      .get<{ available: boolean }>(`${this.api}/auth/username-available`, { params: { username } })
      .pipe(map((response) => response.available));
  }

  /** Gets a new access token. Fails (and clears the session) if the refresh token is no longer valid. */
  public refresh(): Observable<string> {
    if (this.refreshInFlight) return this.refreshInFlight;
    const refreshToken = this.storedRefreshToken();
    if (!refreshToken) return throwError(() => new NoSessionError());

    this.refreshInFlight = this.http.post<AuthSession>(`${this.api}/auth/refresh`, { refreshToken }).pipe(
      map((session) => {
        this.apply(session);
        return session.accessToken;
      }),
      catchError((error: unknown) => {
        // Only forget the session when the server rejected it; keep it on network errors.
        if (isSessionRejected(error)) this.clear();
        return throwError(() => error);
      }),
      finalize(() => (this.refreshInFlight = null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.refreshInFlight;
  }

  public logout(): void {
    const refreshToken = this.storedRefreshToken();
    this.clear();
    void this.router.navigate(['/auth/login']);
    if (refreshToken) {
      this.http.post(`${this.api}/auth/logout`, { refreshToken }).pipe(catchError(() => of(null))).subscribe();
    }
  }

  /** The session ended on its own (refresh token expired or revoked). */
  public expire(): void {
    this.clear();
    if (this.router.url.startsWith('/auth')) return;
    void this.router.navigate(['/auth/login'], { queryParams: { sesion: 'expirada' } });
  }

  /** Own photo. The image is already cropped and resized on the client. */
  public uploadAvatar(image: Blob, fileName: string): Observable<User> {
    const form = new FormData();
    form.append('file', image, fileName);
    return this.http.post<User>(`${this.api}/auth/me/avatar`, form).pipe(tap((user) => this.currentUser.set(user)));
  }

  public removeAvatar(): Observable<User> {
    return this.http.delete<User>(`${this.api}/auth/me/avatar`).pipe(tap((user) => this.currentUser.set(user)));
  }

  /** Realtime echo of our own profile (another tab or device changed it). */
  public patchSelf(user: User): void {
    const current = this.currentUser();
    if (current && current.id === user.id) this.currentUser.set({ ...current, ...user });
  }

  public updateProfile(changes: Partial<Pick<User, 'status_message' | 'hide_last_seen' | 'hide_typing'>>): Observable<User> {
    return this.http.patch<User>(`${this.api}/auth/me`, changes).pipe(tap((user) => this.currentUser.set(user)));
  }

  public changePassword(currentPassword: string, newPassword: string): Observable<User> {
    return this.http
      .post<AuthSession>(`${this.api}/auth/me/password`, { currentPassword, newPassword })
      .pipe(map((session) => this.apply(session)));
  }

  private apply(session: AuthSession): User {
    this.accessToken = session.accessToken;
    this.currentUser.set(session.user);
    const vault = this.vault;
    if (vault) {
      // Rotated token: keep it in memory right away, seal it for the device.
      this.memoryRefresh = session.refreshToken;
      void seal(vault, session.refreshToken).then((sealed) => {
        if (this.vault === vault && this.memoryRefresh === session.refreshToken) this.write(sealed);
      });
    } else {
      this.write(session.refreshToken);
    }
    return session.user;
  }

  private clear(): void {
    this.accessToken = null;
    this.currentUser.set(null);
    this.vault = null;
    this.memoryRefresh = null;
    this.write(null);
  }

  private write(value: string | null): void {
    this.pinEnabled.set(isVaulted(value));
    try {
      if (value === null) localStorage.removeItem(REFRESH_KEY);
      else localStorage.setItem(REFRESH_KEY, value);
    } catch {
      /* private mode: the session lasts until the tab closes */
    }
  }

  private rawStored(): string | null {
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  }

  /** The usable refresh token: decrypted in memory, or stored in clear. */
  private storedRefreshToken(): string | null {
    if (this.memoryRefresh) return this.memoryRefresh;
    try {
      const legacy = localStorage.getItem(LEGACY_REFRESH_KEY);
      if (legacy) {
        localStorage.removeItem(LEGACY_REFRESH_KEY);
        localStorage.removeItem('jfchat.theme');
        if (!localStorage.getItem(REFRESH_KEY)) localStorage.setItem(REFRESH_KEY, legacy);
      }
      const stored = localStorage.getItem(REFRESH_KEY);
      return isVaulted(stored) ? null : stored;
    } catch {
      return null;
    }
  }
}
