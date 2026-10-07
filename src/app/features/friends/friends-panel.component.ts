import { ChangeDetectionStrategy, Component, DestroyRef, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { displayName, type User } from '../../core/models';
import { ConfirmService } from '../../core/ui/confirm.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { PresenceStore } from '../chat/presence.store';
import { FriendsApi } from './friends.api';
import { FriendsStore } from './friends.store';

@Component({
  selector: 'app-friends-panel',
  imports: [AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6 p-3">
      <section aria-labelledby="search-title">
        <h3 id="search-title" class="px-1 pb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">Buscar personas</h3>
        <input
          type="search"
          class="input"
          placeholder="Nombre o usuario"
          aria-label="Buscar personas por nombre o usuario"
          (input)="search$.next($any($event.target).value)"
          data-testid="user-search"
        />
        @if (searching()) {
          <p class="px-1 pt-2 text-xs text-gray-500">Buscando…</p>
        } @else if (term().length >= 2 && !results().length) {
          <p class="px-1 pt-2 text-xs text-gray-500">No encontramos a nadie con «{{ term() }}».</p>
        }
        @if (results().length) {
          <ul class="mt-2 space-y-1" data-testid="search-results">
            @for (user of results(); track user.id) {
              @let relation = friends.relationWith(user.id);
              <li class="flex items-center gap-3 rounded-xl p-2 hover:bg-gray-100 dark:hover:bg-gray-800">
                <app-avatar [user]="user" [size]="40" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium">{{ name(user) }}</span>
                  <span class="block truncate text-xs text-gray-500">&#64;{{ user.username }}</span>
                </span>
                @if (relation?.status === 'accepted') {
                  <button type="button" class="btn-secondary px-3 py-1.5 text-xs" (click)="chat.emit(user.id)">Chatear</button>
                } @else if (relation?.status === 'pending' && relation?.direction === 'outgoing') {
                  <span class="text-xs text-gray-500">Pendiente</span>
                } @else if (relation?.status === 'pending') {
                  <button type="button" class="btn-primary px-3 py-1.5 text-xs" (click)="friends.accept(relation!.id)">Aceptar</button>
                } @else {
                  <button type="button" class="btn-primary px-3 py-1.5 text-xs" (click)="friends.request(user.id)" [attr.aria-label]="'Agregar a ' + name(user)">Agregar</button>
                }
              </li>
            }
          </ul>
        }
      </section>

      @if (friends.incoming().length) {
        <section aria-labelledby="incoming-title">
          <h3 id="incoming-title" class="px-1 pb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
            Solicitudes recibidas ({{ friends.incoming().length }})
          </h3>
          <ul class="space-y-1" data-testid="incoming-requests">
            @for (request of friends.incoming(); track request.id) {
              <li class="flex items-center gap-3 rounded-xl p-2">
                <app-avatar [user]="request.friend" [size]="40" />
                <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ name(request.friend) }}</span>
                <button type="button" class="btn-primary px-3 py-1.5 text-xs" (click)="friends.accept(request.id)">Aceptar</button>
                <button type="button" class="btn-secondary px-3 py-1.5 text-xs" (click)="friends.reject(request.id)">Rechazar</button>
              </li>
            }
          </ul>
        </section>
      }

      @if (friends.outgoing().length) {
        <section aria-labelledby="outgoing-title">
          <h3 id="outgoing-title" class="px-1 pb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">Solicitudes enviadas</h3>
          <ul class="space-y-1">
            @for (request of friends.outgoing(); track request.id) {
              <li class="flex items-center gap-3 rounded-xl p-2">
                <app-avatar [user]="request.friend" [size]="40" />
                <span class="min-w-0 flex-1 truncate text-sm">{{ name(request.friend) }}</span>
                <button type="button" class="text-xs text-gray-500 hover:underline" (click)="friends.remove(request.id)">Cancelar</button>
              </li>
            }
          </ul>
        </section>
      }

      <section aria-labelledby="friends-title">
        <h3 id="friends-title" class="px-1 pb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">Amigos ({{ friends.friends().length }})</h3>
        @if (!friends.friends().length) {
          <p class="px-1 text-sm text-gray-500 dark:text-gray-400">Busca a alguien por su usuario y envíale una solicitud.</p>
        }
        <ul class="space-y-1" data-testid="friends-list">
          @for (friendship of friends.friends(); track friendship.id) {
            <li class="group flex items-center gap-3 rounded-xl p-2 hover:bg-gray-100 dark:hover:bg-gray-800">
              <app-avatar [user]="friendship.friend" [size]="40" [online]="presence.isOnline(friendship.friend.id)" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium">{{ name(friendship.friend) }}</span>
                <span class="block truncate text-xs text-gray-500">{{ presence.label(friendship.friend.id, friendship.friend.last_seen) }}</span>
                @if (friendship.friend.status_message; as statusMessage) {
                  <span class="block truncate text-xs text-gray-600 italic dark:text-gray-300" data-testid="friend-status-message"><span class="sr-only">Estado: </span>{{ statusMessage }}</span>
                }
              </span>
              <button type="button" class="btn-secondary px-3 py-1.5 text-xs" (click)="chat.emit(friendship.friend.id)" [attr.aria-label]="'Chatear con ' + name(friendship.friend)">Chatear</button>
              <button type="button" class="btn-icon h-8 w-8 text-sm" (click)="removeFriend(friendship.id, friendship.friend)" [attr.aria-label]="'Eliminar a ' + name(friendship.friend) + ' de tus amigos'">✕</button>
            </li>
          }
        </ul>
      </section>
    </div>
  `,
})
export class FriendsPanelComponent {
  protected readonly friends = inject(FriendsStore);
  protected readonly presence = inject(PresenceStore);
  private readonly api = inject(FriendsApi);
  private readonly confirm = inject(ConfirmService);
  public readonly chat = output<number>();

  protected readonly search$ = new Subject<string>();
  protected readonly term = signal('');
  protected readonly results = signal<User[]>([]);
  protected readonly searching = signal(false);

  public constructor() {
    this.search$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap((term) => this.term.set(term.trim())),
        switchMap((term) => {
          if (term.trim().length < 2) return of([] as User[]);
          this.searching.set(true);
          return this.api.searchUsers(term.trim()).pipe(catchError(() => of([] as User[])));
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((users) => {
        this.searching.set(false);
        this.results.set(users);
      });
  }

  protected name(user: User): string {
    return displayName(user);
  }

  protected async removeFriend(id: number, user: User): Promise<void> {
    const ok = await this.confirm.ask({
      title: `¿Eliminar a ${displayName(user)}?`,
      text: 'Dejarán de ser amigos. Podrás enviarle otra solicitud cuando quieras.',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (ok) await this.friends.remove(id);
  }
}
