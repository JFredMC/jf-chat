import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { displayName, type Conversation, type Message } from '../../core/models';
import { AvatarComponent } from '../../shared/avatar.component';
import { listTimeLabel } from '../../shared/time';
import { ChatStore } from './chat.store';
import { MessageStatusComponent } from './message-status.component';
import { PresenceStore } from './presence.store';

@Component({
  selector: 'app-conversation-list',
  imports: [AvatarComponent, MessageStatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.loading() && !store.loaded()) {
      <ul class="space-y-1 p-2" aria-hidden="true">
        @for (i of [1, 2, 3, 4, 5]; track i) {
          <li class="flex items-center gap-3 rounded-xl p-3">
            <span class="h-12 w-12 animate-pulse rounded-full bg-gray-200 dark:bg-gray-800"></span>
            <span class="flex-1 space-y-2">
              <span class="block h-3 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-800"></span>
              <span class="block h-3 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-800"></span>
            </span>
          </li>
        }
      </ul>
    } @else if (!filtered().length) {
      <div class="flex flex-col items-center gap-3 px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
        @if (filter()) {
          <p>No hay chats que coincidan con «{{ filter() }}».</p>
        } @else {
          <span class="text-4xl" aria-hidden="true">💬</span>
          <p>Aún no tienes conversaciones.</p>
          <button type="button" class="btn-primary" (click)="findFriends.emit()">Conecta con un código</button>
        }
      </div>
    } @else {
      <ul class="p-2" role="list" aria-label="Conversaciones" data-testid="conversation-list">
        @for (conversation of filtered(); track conversation.id) {
          @let other = store.otherMember(conversation);
          @let unread = conversation.unread_count;
          <li>
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-gray-100 dark:hover:bg-gray-800"
              [class]="conversation.id === store.activeId() ? 'bg-indigo-50 dark:bg-indigo-950/60' : ''"
              [attr.aria-current]="conversation.id === store.activeId() ? 'true' : null"
              (click)="open.emit(conversation.id)"
              data-testid="conversation-item"
            >
              <app-avatar [user]="other?.user" [size]="48" [online]="presence.isOnline(other?.user_id)" />
              <span class="min-w-0 flex-1">
                <span class="flex items-baseline justify-between gap-2">
                  <span class="truncate font-semibold text-gray-900 dark:text-white">{{ title(conversation) }}</span>
                  @if (conversation.last_message; as last) {
                    <time class="shrink-0 text-xs" [class]="unread ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'text-gray-500'">{{ time(last.created_at) }}</time>
                  }
                </span>
                @if (other?.user?.status_message; as statusMessage) {
                  <span class="block truncate text-xs text-gray-500 italic dark:text-gray-400" data-testid="conversation-status-message">
                    <span class="sr-only">Estado: </span>{{ statusMessage }}
                  </span>
                }
                <span class="mt-0.5 flex items-center gap-1.5">
                  @if (presence.typingIn(conversation.id).length) {
                    <span class="truncate text-sm font-medium text-indigo-600 dark:text-indigo-400">escribiendo…</span>
                  } @else if (conversation.last_message; as last) {
                    @if (last.sender_id === meId()) {
                      <app-message-status class="shrink-0 text-gray-500" [state]="store.deliveryState(conversation, $any(last))" />
                    }
                    <span class="truncate text-sm" [class]="unread ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'">{{ preview(last) }}</span>
                  } @else {
                    <span class="truncate text-sm text-gray-400">Sin mensajes</span>
                  }
                  @if (unread) {
                    <span class="ml-auto min-w-5 shrink-0 rounded-full bg-indigo-600 px-1.5 text-center text-xs leading-5 font-bold text-white" [attr.aria-label]="unread + ' sin leer'" data-testid="unread-badge">
                      {{ unread > 99 ? '99+' : unread }}
                    </span>
                  }
                </span>
              </span>
            </button>
          </li>
        }
      </ul>
    }
  `,
})
export class ConversationListComponent {
  protected readonly store = inject(ChatStore);
  protected readonly presence = inject(PresenceStore);
  public readonly filter = input('');
  public readonly open = output<number>();
  public readonly findFriends = output();

  protected readonly meId = computed(() => this.store.me()?.id);
  protected readonly filtered = computed(() => {
    const term = this.filter().trim().toLowerCase();
    const list = this.store.conversations();
    return term ? list.filter((c) => this.title(c).toLowerCase().includes(term)) : list;
  });

  protected title(conversation: Conversation): string {
    return conversation.name || displayName(this.store.otherMember(conversation)?.user);
  }

  protected time(value: string): string {
    return listTimeLabel(value);
  }

  protected preview(message: Message): string {
    const prefix = message.sender_id === this.meId() ? 'Tú: ' : '';
    if (message.content) return prefix + message.content;
    if (message.message_type === 'image') return `${prefix}📷 Foto`;
    if (message.message_type === 'video') return `${prefix}🎬 Video`;
    if (message.attachments?.length || message.message_type === 'file') return `${prefix}📎 Archivo`;
    return prefix;
  }
}
