import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { displayName, type Conversation } from '../../core/models';
import { ConfirmService } from '../../core/ui/confirm.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { ChatStore, type Thread } from './chat.store';
import { MessageListComponent } from './message-list.component';
import { PartnerProfileComponent } from './partner-profile.component';
import { PresenceStore } from './presence.store';

@Component({
  selector: 'app-chat-view',
  imports: [AvatarComponent, MessageListComponent, PartnerProfileComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex h-full min-h-0 flex-col bg-gray-100 dark:bg-gray-950' },
  template: `
    <header class="flex items-center gap-2 border-b border-gray-200 bg-white px-2 py-2 sm:px-4 dark:border-gray-800 dark:bg-gray-900">
      <button type="button" class="btn-icon md:hidden" (click)="back.emit()" aria-label="Volver a los chats">
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
      <button type="button" class="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left hover:bg-gray-100 dark:hover:bg-gray-800" (click)="profileOpen.set(true)"
        [attr.aria-label]="'Ver el perfil de ' + title()" aria-haspopup="dialog" data-testid="open-partner">
      <app-avatar [user]="other()?.user" [size]="40" [online]="presence.isOnline(other()?.user_id)" />
      <div class="min-w-0 flex-1">
        <h2 class="truncate font-semibold text-gray-900 dark:text-white" data-testid="chat-title">{{ title() }}</h2>
        <p class="truncate text-xs" [class]="typingLabel() ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'" data-testid="chat-status" aria-live="polite">
          {{ typingLabel() || statusLabel() }}
        </p>
        @if (other()?.user?.status_message; as statusMessage) {
          <p class="truncate text-xs text-gray-500 italic dark:text-gray-400" data-testid="chat-status-message" [attr.title]="statusMessage">
            <span class="sr-only">Estado: </span>{{ statusMessage }}
          </p>
        }
      </div>
      </button>
      <button type="button" class="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/50"
        (click)="confirmDestroy()" aria-label="Autodestruir el chat" title="Autodestruir el chat" data-testid="destroy-chat">
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 22c4 0 7-2.7 7-6.8 0-3.3-2.1-5.4-3.6-7.2-.5 1.9-1.6 3-2.8 3.4C13 8 12 5 9.5 2.5 9.7 6.3 5 8.9 5 15.2 5 19.3 8 22 12 22Z" stroke-linejoin="round" /></svg>
        <span class="hidden sm:inline">Autodestruir</span>
      </button>
    </header>
    <app-partner-profile [user]="other()?.user" [(open)]="profileOpen" (destroy)="profileOpen.set(false); confirmDestroy()" />

    <app-message-list class="min-h-0 flex-1" [conversation]="conversation()" [thread]="thread()" (loadOlder)="store.loadOlder()" (reply)="store.reply($event)" />

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
  protected readonly profileOpen = signal(false);

  protected readonly other = computed(() => this.store.otherMember(this.conversation()));
  protected readonly title = computed(() => this.conversation().name || displayName(this.other()?.user));
  protected readonly statusLabel = computed(() => this.presence.label(this.other()?.user_id, this.other()?.user.last_seen, !!this.other()?.user.hide_last_seen));
  protected readonly typingName = computed(() => {
    const ids = this.presence.typingIn(this.conversation().id);
    const member = this.conversation().members.find((m) => m.user_id === ids[0]);
    return member ? member.user.username : 'Alguien';
  });
  protected readonly typingLabel = computed(() => (this.presence.typingIn(this.conversation().id).length ? 'escribiendo…' : ''));

  protected async confirmDestroy(): Promise<void> {
    const ok = await this.confirm.ask({
      title: '¿Autodestruir este chat?',
      text: `Se borran ahora todos los mensajes, fotos y videos, para ti y para ${this.title()}. No se puede deshacer.`,
      confirmLabel: 'Autodestruir',
      danger: true,
    });
    if (ok && (await this.store.destroy(this.conversation().id))) this.back.emit();
  }
}

