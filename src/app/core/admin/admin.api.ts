import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { API_URL } from '../config';

export interface AdminStats {
  users: number;
  active24h: number;
  active7d: number;
  messages24h: number;
}

export interface AdminUser {
  id: number;
  username: string;
  created_at: string;
  last_seen: string | null;
  status: 'active' | 'blocked';
  role: 'user' | 'admin';
  has_invite: boolean;
}

/** Admin endpoints: counts and account metadata only, never messages or media. */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);

  /** True only when the server confirms the admin role (403/404 → false). */
  public isAdmin(): Observable<boolean> {
    return this.http.get(`${this.api}/admin/me`).pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }

  public stats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${this.api}/admin/stats`);
  }

  public users(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${this.api}/admin/users`);
  }

  public action(id: number, action: 'block' | 'unblock' | 'logout'): Observable<unknown> {
    return this.http.post(`${this.api}/admin/users/${id}/${action}`, {});
  }

  public remove(id: number): Observable<unknown> {
    return this.http.delete(`${this.api}/admin/users/${id}`);
  }

  public newInvite(id: number): Observable<{ code: string }> {
    return this.http.post<{ code: string }>(`${this.api}/admin/users/${id}/invite`, {});
  }

  public revokeInvite(id: number): Observable<unknown> {
    return this.http.delete(`${this.api}/admin/users/${id}/invite`);
  }
}
