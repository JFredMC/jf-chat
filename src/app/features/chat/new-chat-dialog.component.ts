import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, model, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { displayName, type User } from '../../core/models';
import { AvatarComponent } from '../../shared/avatar.component';
import { FriendsApi } from '../friends/friends.api';
import { FriendsStore } from '../friends/friends.store';

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * "Nuevo chat": pick a friend to talk to, or find someone and send a friend
 * request (the API only allows direct chats between friends).
 */
@Component({
  selector: 'app-new-chat-dialog',
  imports: [AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      class="m-auto w-[min(28rem,calc(100%-2rem))] rounded-2xl bg-white p-0 text-gray-900 shadow-2xl backdrop:bg-black/50 dark:bg-gray-900 dark:text-gray-100"
      aria-labelledby="new-chat-title"
      (close)="open.set(false)"
      data-testid="new-chat-dialog"
    >
      <div class="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
        <h2 id="new-chat-title" class="text-lg font-semibold">Nuevo chat</h2>
        <button type="button" class="btn-icon" (click)="open.set(false)" aria-label="Cerrar">✕</button>
      </div>
      <div class="p-5">
        <label class="label" for="new-chat-search">Busca un amigo o una persona</label>
        <input
          #search
          id="new-chat-search"
          type="search"
          class="input"
          placeholder="Nombre o usuario"
          autocomplete="off"
          [value]="term()"
          (input)="onInput($any($event.target).value)"
          data-testid="new-chat-search"
        />
      </div>
      <div class="max-h-[60dvh] overflow-y-auto px-3 pb-4">
        @if (matchingFriends().length) {
          <h3 class="px-2 pb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">Amigos</h3>
          <ul class="mb-3 space-y-1" data-testid="new-chat-friends">
            @for (friend of matchingFriends(); track friend.id) {
              <li>
                <button type="button" class="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
                  (click)="start(friend.id)" [attr.aria-label]="'Chatear con ' + name(friend)">
                  <app-avatar [user]="friend" [size]="40" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium">{{ name(friend) }}</span>
                    <span class="block truncate text-xs text-gray-500">{{ friend.status_message || '@' + friend.username }}</span>
                  </span>
                  <span class="text-xs font-semibold text-indigo-600 dark:text-indigo-400" aria-hidden="true">Chatear</span>
                </button>
              </li>
            }
          </ul>
        }

        @if (searching()) {
          <p class="px-2 py-2 text-sm text-gray-500" role="status">Buscando…</p>
        } @else if (others().length) {
          <h3 class="px-2 pb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">Otras personas</h3>
          <ul class="space-y-1" data-testid="new-chat-results">
            @for (person of others(); track person.id) {
              @let relation = friends.relationWith(person.id);
              <li class="flex items-center gap-3 rounded-xl p-2">
                <app-avatar [user]="person" [size]="40" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium">{{ name(person) }}</span>
                  <span class="block truncate text-xs text-gray-500">&#64;{{ person.username }}</span>
                </span>
                @if (relation?.status === 'pending' && relation?.direction === 'outgoing') {
                  <span class="text-xs text-gray-500">Solicitud enviada</span>
                } @else if (relation?.status === 'pending') {
                  <button type="button" class="btn-primary px-3 py-1.5 text-xs" (click)="friends.accept(relation!.id)">Aceptar</button>
                } @else {
                  <button type="button" class="btn-primary px-3 py-1.5 text-xs" (click)="friends.request(person.id)" [attr.aria-label]="'Enviar solicitud de amistad a ' + name(person)">
                    Agregar
                  </button>
                }
              </li>
            }
          </ul>
          <p class="px-2 pt-2 text-xs text-gray-500">Podrán chatear cuando acepte tu solicitud.</p>
        } @else if (term().trim().length >= 2 && !matchingFriends().length) {
          <p class="px-2 py-2 text-sm text-gray-500">No encontramos a nadie con «{{ term().trim() }}».</p>
        } @else if (!friends.friends().length && term().trim().length < 2) {
          <p class="px-2 py-2 text-sm text-gray-500">Aún no tienes amigos. Escribe al menos 2 letras para buscar personas.</p>
        }
      </div>
    </dialog>
  `,
})
export class NewChatDialogComponent {
  protected readonly friends = inject(FriendsStore);
  private readonly api = inject(FriendsApi);
  public readonly open = model(false);
  public readonly chat = output<number>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('search');

  protected readonly term = signal('');
  protected readonly results = signal<User[]>([]);
  protected readonly searching = signal(false);
  private readonly search$ = new Subject<string>();

  protected readonly matchingFriends = computed(() => {
    const term = normalize(this.term().trim());
    const list = this.friends.friends().map((f) => f.friend);
    return term ? list.filter((u) => normalize(`${u.username} ${displayName(u)}`).includes(term)) : list;
  });
  /** Search results that are not friends yet. */
  protected readonly others = computed(() => {
    const friendIds = new Set(this.matchingFriends().map((u) => u.id));
    return this.results().filter((u) => !friendIds.has(u.id) && this.friends.relationWith(u.id)?.status !== 'accepted');
  });

  public constructor() {
    this.search$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          if (term.length < 2) return of([] as User[]);
          this.searching.set(true);
          return this.api.searchUsers(term).pipe(catchError(() => of([] as User[])));
        }),
        tap(() => this.searching.set(false)),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((users) => this.results.set(users));

    effect(() => {
      const element = this.dialog().nativeElement;
      if (this.open()) {
        if (!element.open) {
          this.term.set('');
          this.results.set([]);
          this.search$.next('');
          element.showModal();
          queueMicrotask(() => this.searchInput().nativeElement.focus());
        }
      } else if (element.open) {
        element.close();
      }
    });
  }

  protected onInput(value: string): void {
    this.term.set(value);
    this.search$.next(value.trim());
  }

  protected start(userId: number): void {
    this.open.set(false);
    this.chat.emit(userId);
  }

  protected name(user: User): string {
    return displayName(user);
  }
}
