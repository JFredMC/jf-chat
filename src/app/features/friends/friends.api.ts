import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../../core/config';
import type { Friendship, User } from '../../core/models';

@Injectable({ providedIn: 'root' })
export class FriendsApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);

  public list(): Observable<Friendship[]> {
    return this.http.get<Friendship[]>(`${this.api}/friendship`);
  }

  public request(friendId: number): Observable<Friendship> {
    return this.http.post<Friendship>(`${this.api}/friendship/request`, { friendId });
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

  public searchUsers(q: string): Observable<User[]> {
    return this.http.get<User[]>(`${this.api}/user/search`, { params: { q } });
  }
}
