import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { displayName, type Conversation } from '../../core/models';
import { ConfirmService } from '../../core/ui/confirm.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { ChatStore, type Thread } from './chat.store';
import { MessageListComponent } from './message-list.component';
import { PresenceStore } from './presence.store';

@Component({
  selector: 'app-chat-view',
  imports: [AvatarComponent, MessageListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex h-full min-h-0 flex-col bg-gray-100 dark:bg-gray-950' },
  template: `
    <header class="flex items-center gap-2 border-b border-gray-200 bg-white px-2 py-2 sm:px-4 dark:border-gray-800 dark:bg-gray-900">
      <button type="button" class="btn-icon md:hidden" (click)="back.emit()" aria-label="Volver a los chats">
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
      <app-avatar [user]="other()?.user" [size]="40" [online]="presence.isOnline(other()?.user_id)" />
      <div class="min-w-0 flex-1">
        <h2 class="truncate font-semibold text-gray-900 dark:text-white" data-testid="chat-title">{{ title() }}</h2>
        <p class="truncate text-xs" [class]="typingLabel() ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'" data-testid="chat-status" aria-live="polite">
          {{ typingLabel() || statusLabel() }}
        </p>
      </div>
      <button type="button" class="btn-icon" (click)="confirmLeave()" aria-label="Eliminar chat" title="Eliminar chat">
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
    </header>

    <app-message-list class="min-h-0 flex-1" [conversation]="conversation()" [thread]="thread()" (loadOlder)="store.loadOlder()" />

    @if (typingLabel()) {
      <div class="flex items-center gap-2 px-4 pb-2 text-xs text-gray-500 dark:text-gray-400" data-testid="typing-indicator">
        <span class="flex items-center gap-1 rounded-full bg-white px-3 py-2 shadow-sm dark:bg-gray-800" aria-hidden="true">
          <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
        </span>
        <span>{{ typingName() }} está escribiendo…</span>
      </div>
    }

    <ng-content select="[chatFooter]" />
  `,
})
export class ChatViewComponent {
  protected readonly store = inject(ChatStore);
  protected readonly presence = inject(PresenceStore);
  private readonly confirm = inject(ConfirmService);

  public readonly conversation = input.required<Conversation>();
  public readonly thread = input.required<Thread>();
  public readonly back = output();

  protected readonly other = computed(() => this.store.otherMember(this.conversation()));
  protected readonly title = computed(() => this.conversation().name || displayName(this.other()?.user));
  protected readonly statusLabel = computed(() => this.presence.label(this.other()?.user_id, this.other()?.user.last_seen));
  protected readonly typingName = computed(() => {
    const ids = this.presence.typingIn(this.conversation().id);
    const member = this.conversation().members.find((m) => m.user_id === ids[0]);
    return member ? member.user.first_name || member.user.username : 'Alguien';
  });
  protected readonly typingLabel = computed(() => (this.presence.typingIn(this.conversation().id).length ? 'escribiendo…' : ''));

  protected async confirmLeave(): Promise<void> {
    const ok = await this.confirm.ask({
      title: '¿Eliminar este chat?',
      text: 'Se ocultará de tu lista. Si recibes un mensaje nuevo, volverá a aparecer.',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (ok) await this.store.leave(this.conversation().id);
  }
}

