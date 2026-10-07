import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../../core/config';
import type { Friendship, InviteCode } from '../../core/models';

/**
 * Contacts. There is no user search in Velo: the only way to connect is
 * redeeming someone's single-use invite code.
 */
@Injectable({ providedIn: 'root' })
export class FriendsApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);

  public list(): Observable<Friendship[]> {
    return this.http.get<Friendship[]>(`${this.api}/friendship`);
  }

  public myInvite(): Observable<InviteCode> {
    return this.http.get<InviteCode>(`${this.api}/auth/me/invite`);
  }

  public rotateInvite(): Observable<InviteCode> {
    return this.http.post<InviteCode>(`${this.api}/auth/me/invite/rotate`, {});
  }

  public redeem(code: string): Observable<Friendship> {
    return this.http.post<Friendship>(`${this.api}/friendship/invite`, { code });
  }

  public accept(id: number): Observable<Friendship> {
    return this.http.post<Friendship>(`${this.api}/friendship/${id}/accept`, {});
  }

  public reject(id: number): Observable<Friendship> {
    return this.http.post<Friendship>(`${this.api}/friendship/${id}/reject`, {});
  }

  public remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/friendship/${id}`);
  }
}
