import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of, shareReplay } from 'rxjs';
import { API_URL } from '../core/config';

interface Cached {
  url$: Observable<string>;
  until: number;
}

/**
 * Avatars are private: the API hands a short-lived signed URL only to a
 * signed-in contact. URLs are cached until shortly before they expire.
 */
@Injectable({ providedIn: 'root' })
export class AvatarUrlService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly cache = new Map<string, Cached>();

  public resolve(path: string): Observable<string> {
    if (!path.startsWith('/')) return of(path);
    const hit = this.cache.get(path);
    if (hit && hit.until > Date.now()) return hit.url$;
    const entry: Cached = { until: Date.now() + 240_000, url$: of('') };
    entry.url$ = this.http.get<{ url: string; expiresIn: number }>(`${this.api}${path}`).pipe(
      map((res) => {
        entry.until = Date.now() + Math.max(10, res.expiresIn - 30) * 1000;
        return res.url;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.cache.set(path, entry);
    return entry.url$;
  }

  public clear(): void {
    this.cache.clear();
  }
}
