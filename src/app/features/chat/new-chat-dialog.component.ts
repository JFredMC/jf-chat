import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, model, output, signal, viewChild } from '@angular/core';
import { displayName, type User } from '../../core/models';
import { AvatarComponent } from '../../shared/avatar.component';
import { FriendsStore } from '../friends/friends.store';
import { MyInviteComponent, RedeemInviteComponent } from '../friends/invite.component';

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * "Nuevo chat": pick a contact, or connect with someone through an invite
 * code (Velo has no user directory or search).
 */
@Component({
  selector: 'app-new-chat-dialog',
  imports: [AvatarComponent, MyInviteComponent, RedeemInviteComponent],
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
      <div class="max-h-[75dvh] space-y-5 overflow-y-auto p-5">
        @if (friends.friends().length) {
          <div>
            @if (friends.friends().length > 5) {
              <input type="search" class="input mb-2" placeholder="Filtrar contactos" aria-label="Filtrar contactos" autocomplete="off"
                [value]="term()" (input)="term.set($any($event.target).value)" data-testid="new-chat-search" />
            }
            <h3 class="px-1 pb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">Contactos</h3>
            <ul class="space-y-1" data-testid="new-chat-friends">
              @for (friend of matchingFriends(); track friend.id) {
                <li>
                  <button type="button" class="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
                    (click)="start(friend.id)" [attr.aria-label]="'Chatear con ' + name(friend)">
                    <app-avatar [user]="friend" [size]="40" />
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm font-medium">{{ name(friend) }}</span>
                      @if (friend.status_message) {
                        <span class="block truncate text-xs text-gray-500">{{ friend.status_message }}</span>
                      }
                    </span>
                    <span class="text-xs font-semibold text-cyan-600 dark:text-cyan-400" aria-hidden="true">Chatear</span>
                  </button>
                </li>
              }
            </ul>
          </div>
        }
        <app-redeem-invite (added)="start($event)" />
        <app-my-invite />
      </div>
    </dialog>
  `,
})
export class NewChatDialogComponent {
  protected readonly friends = inject(FriendsStore);
  public readonly open = model(false);
  public readonly chat = output<number>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly term = signal('');
  protected readonly matchingFriends = computed(() => {
    const term = normalize(this.term().trim());
    const list = this.friends.friends().map((f) => f.friend);
    return term ? list.filter((u) => normalize(u.username).includes(term)) : list;
  });

  public constructor() {
    effect(() => {
      const element = this.dialog().nativeElement;
      if (this.open()) {
        if (!element.open) {
          this.term.set('');
          element.showModal();
        }
      } else if (element.open) {
        element.close();
      }
    });
  }

  protected start(userId: number): void {
    this.open.set(false);
    this.chat.emit(userId);
  }

  protected name(user: User): string {
    return displayName(user);
  }
}
