import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { displayName, type User } from '../../core/models';
import { ConfirmService } from '../../core/ui/confirm.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { PresenceStore } from '../chat/presence.store';
import { FriendsStore } from './friends.store';
import { MyInviteComponent, RedeemInviteComponent } from './invite.component';

/** Contacts: my invite code, redeem a code, legacy pending requests, the contact list. */
@Component({
  selector: 'app-friends-panel',
  imports: [AvatarComponent, MyInviteComponent, RedeemInviteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6 p-3">
      <app-my-invite />
      <app-redeem-invite (added)="chat.emit($event)" />

      @if (friends.incoming().length) {
        <section aria-labelledby="incoming-title">
          <h3 id="incoming-title" class="px-1 pb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
            Solicitudes pendientes ({{ friends.incoming().length }})
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
        <h3 id="friends-title" class="px-1 pb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">Contactos ({{ friends.friends().length }})</h3>
        @if (!friends.friends().length) {
          <p class="px-1 text-sm text-gray-500 dark:text-gray-400">Nadie puede encontrarte por tu usuario. Para conectar, uno de los dos comparte su código y el otro lo escribe arriba.</p>
        }
        <ul class="space-y-1" data-testid="friends-list">
          @for (friendship of friends.friends(); track friendship.id) {
            <li class="group flex items-center gap-3 rounded-xl p-2 hover:bg-gray-100 dark:hover:bg-gray-800">
              <app-avatar [user]="friendship.friend" [size]="40" [online]="presence.isOnline(friendship.friend.id)" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium">{{ name(friendship.friend) }}</span>
                <span class="block truncate text-xs text-gray-500">{{ presence.label(friendship.friend.id, friendship.friend.last_seen, !!friendship.friend.hide_last_seen) }}</span>
                @if (friendship.friend.status_message; as statusMessage) {
                  <span class="block truncate text-xs text-gray-600 italic dark:text-gray-300" data-testid="friend-status-message"><span class="sr-only">Estado: </span>{{ statusMessage }}</span>
                }
              </span>
              <button type="button" class="btn-secondary px-3 py-1.5 text-xs" (click)="chat.emit(friendship.friend.id)" [attr.aria-label]="'Chatear con ' + name(friendship.friend)">Chatear</button>
              <button type="button" class="btn-icon h-8 w-8 text-sm" (click)="removeFriend(friendship.id, friendship.friend)" [attr.aria-label]="'Eliminar a ' + name(friendship.friend) + ' de tus contactos'">✕</button>
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
  private readonly confirm = inject(ConfirmService);
  public readonly chat = output<number>();

  protected name(user: User): string {
    return displayName(user);
  }

  protected async removeFriend(id: number, user: User): Promise<void> {
    const ok = await this.confirm.ask({
      title: `¿Eliminar a ${displayName(user)}?`,
      text: 'Dejarán de ser contactos. Para volver a hablar necesitarán un código nuevo.',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (ok) await this.friends.remove(id);
  }
}
