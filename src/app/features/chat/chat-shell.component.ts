import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { AuthStore } from '../../core/auth/auth.store';
import { DEMO_CONTROLS } from '../../core/config';
import { displayName } from '../../core/models';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ThemeService } from '../../core/ui/theme.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { FriendsPanelComponent } from '../friends/friends-panel.component';
import { FriendsStore } from '../friends/friends.store';
import { ProfileDialogComponent } from '../profile/profile-dialog.component';
import { ChatViewComponent } from './chat-view.component';
import { ChatStore } from './chat.store';
import { AttachmentTrayComponent } from './attachment-tray.component';
import { ComposerComponent } from './composer.component';
import { ConnectionBannerComponent } from './connection-banner.component';
import { ConversationListComponent } from './conversation-list.component';
import { NewChatDialogComponent } from './new-chat-dialog.component';
import { PresenceStore } from './presence.store';
import { RealtimeService } from './realtime.service';

type Tab = 'chats' | 'friends';

@Component({
  selector: 'app-chat-shell',
  imports: [
    AvatarComponent,
    ConversationListComponent,
    FriendsPanelComponent,
    ChatViewComponent,
    NewChatDialogComponent,
    ComposerComponent,
    AttachmentTrayComponent,
    ConnectionBannerComponent,
    ProfileDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-dvh overflow-hidden bg-white dark:bg-gray-900">
      <!-- Sidebar -->
      <aside
        class="flex w-full min-w-0 flex-col border-r border-gray-200 md:w-[22rem] md:shrink-0 lg:w-96 dark:border-gray-800"
        [class.hidden]="store.activeId() !== null"
        [class.md:flex]="true"
        aria-label="Chats y amigos"
      >
        <header class="flex items-center gap-3 px-4 pt-4 pb-3">
          <button type="button" class="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left" (click)="profileOpen.set(true)" aria-label="Mi perfil: cambiar foto y estado" title="Mi perfil" data-testid="open-profile">
            <app-avatar [user]="auth.user()" [size]="40" />
            <span class="min-w-0">
              <span class="block truncate font-semibold text-gray-900 dark:text-white" data-testid="me-name">{{ myName() }}</span>
              <span class="block truncate text-xs text-gray-500" data-testid="me-status">{{ auth.user()?.status_message || '@' + auth.user()?.username }}</span>
            </span>
          </button>
          <button type="button" class="btn-icon" (click)="theme.toggle()" [attr.aria-label]="theme.isDark() ? 'Usar tema claro' : 'Usar tema oscuro'">
            {{ theme.isDark() ? '☀️' : '🌙' }}
          </button>
          <button type="button" class="btn-icon" (click)="logout()" aria-label="Cerrar sesión" title="Cerrar sesión" data-testid="logout">
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 17l5-5-5-5M20 12H9M12 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
        </header>

        @if (demo) {
          <p class="mx-4 mb-2 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-900" data-testid="demo-banner">
            <span class="flex-1"><strong>Demo:</strong> tus amigos son simulados y los datos viven en tu navegador.</span>
            <button type="button" class="shrink-0 font-semibold underline-offset-2 hover:underline" (click)="resetDemo()">Reiniciar</button>
          </p>
        }

        <div class="px-4 pb-2" role="tablist" aria-label="Secciones">
          <div class="grid grid-cols-2 rounded-xl bg-gray-100 p-1 text-sm font-medium dark:bg-gray-800">
            <button type="button" role="tab" id="tab-chats" aria-controls="panel-chats" [attr.aria-selected]="tab() === 'chats'"
              class="flex items-center justify-center gap-2 rounded-lg py-2 transition" [class]="tab() === 'chats' ? 'bg-white shadow-sm dark:bg-gray-900' : 'text-gray-500'"
              (click)="tab.set('chats')">
              Chats
              @if (store.totalUnread()) {
                <span class="rounded-full bg-indigo-600 px-1.5 text-xs leading-5 text-white">{{ store.totalUnread() }}</span>
              }
            </button>
            <button type="button" role="tab" id="tab-friends" aria-controls="panel-friends" [attr.aria-selected]="tab() === 'friends'"
              class="flex items-center justify-center gap-2 rounded-lg py-2 transition" [class]="tab() === 'friends' ? 'bg-white shadow-sm dark:bg-gray-900' : 'text-gray-500'"
              (click)="tab.set('friends')" data-testid="tab-friends">
              Amigos
              @if (friends.incoming().length) {
                <span class="rounded-full bg-rose-500 px-1.5 text-xs leading-5 text-white" [attr.aria-label]="friends.incoming().length + ' solicitudes'">{{ friends.incoming().length }}</span>
              }
            </button>
          </div>
        </div>

        @if (tab() === 'chats') {
          <div id="panel-chats" role="tabpanel" aria-labelledby="tab-chats" class="relative flex min-h-0 flex-1 flex-col">
            <div class="px-4 pb-1">
              <input type="search" class="input h-10" placeholder="Buscar chat" aria-label="Buscar chat" [value]="filter()" (input)="filter.set($any($event.target).value)" />
            </div>
            <app-conversation-list class="min-h-0 flex-1 overflow-y-auto pb-24" [filter]="filter()" (open)="open($event)" (findFriends)="newChatOpen.set(true)" />
            <!-- Inside the list panel: never over a bottom nav or the open chat; the list leaves room for it. -->
            <button
              type="button"
              class="absolute right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-10 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-700 focus-visible:ring-4 focus-visible:ring-indigo-300 focus-visible:outline-none active:scale-95"
              (click)="newChatOpen.set(true)"
              aria-label="Nuevo chat"
              title="Nuevo chat"
              aria-haspopup="dialog"
              data-testid="new-chat-fab"
            >
              <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke-linecap="round" /></svg>
            </button>
          </div>
        } @else {
          <div id="panel-friends" role="tabpanel" aria-labelledby="tab-friends" class="min-h-0 flex-1 overflow-y-auto">
            <app-friends-panel (chat)="chatWith($event)" />
          </div>
        }
      </aside>

      <!-- Conversation -->
      <main class="min-w-0 flex-1" [class.hidden]="store.activeId() === null" [class.md:block]="true">
        @if (store.active(); as conversation) {
          <app-chat-view [conversation]="conversation" [thread]="store.activeThread()!" (back)="store.select(null)">
            <app-attachment-tray chatFooter #tray [conversationId]="conversation.id" />
            <app-composer
              chatFooter
              [hasExtra]="tray.ready().length > 0"
              [disabled]="tray.busy() || tray.hasErrors()"
              (send)="send($event, tray)"
              (typing)="realtime.typing(conversation.id, $event)"
              (filesPasted)="tray.addFiles($event)"
            >
              <button composerStart type="button" class="btn-icon" (click)="tray.pick()" aria-label="Adjuntar archivo" title="Adjuntar archivo" data-testid="attach">
                <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m21 11.5-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </button>
            </app-composer>
          </app-chat-view>
        } @else {
          <div class="hidden h-full flex-col items-center justify-center gap-4 bg-gray-50 p-8 text-center md:flex dark:bg-gray-950">
            <div class="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-violet-600 text-3xl font-bold text-white shadow-lg shadow-indigo-500/30" aria-hidden="true">JF</div>
            <h1 class="text-xl font-semibold text-gray-900 dark:text-white">Bienvenido a JfChat</h1>
            <p class="max-w-sm text-sm text-gray-500 dark:text-gray-400">Elige una conversación o busca a un amigo para empezar a chatear.</p>
          </div>
        }
      </main>
    </div>
    <app-connection-banner />
    <app-profile-dialog [(open)]="profileOpen" />
    <app-new-chat-dialog [(open)]="newChatOpen" (chat)="chatWith($event)" />
  `,
})
export class ChatShellComponent implements OnInit {
  protected readonly store = inject(ChatStore);
  protected readonly friends = inject(FriendsStore);
  protected readonly auth = inject(AuthStore);
  protected readonly theme = inject(ThemeService);
  protected readonly realtime = inject(RealtimeService);
  private readonly presence = inject(PresenceStore);
  private readonly confirm = inject(ConfirmService);
  private readonly title = inject(Title);
  private readonly document = inject(DOCUMENT);
  protected readonly demo = inject(DEMO_CONTROLS, { optional: true });

  protected readonly tab = signal<Tab>('chats');
  protected readonly filter = signal('');
  protected readonly profileOpen = signal(false);
  protected readonly newChatOpen = signal(false);
  protected readonly myName = computed(() => displayName(this.auth.user()));

  public constructor() {
    effect(() => {
      const unread = this.store.totalUnread();
      this.title.setTitle(unread ? `(${unread}) JfChat` : 'JfChat');
    });
    effect(() => {
      // Seed presence from the REST data until the realtime updates arrive.
      this.presence.seed([
        ...this.store.conversations().flatMap((c) => c.members.map((m) => m.user)),
        ...this.friends.friends().map((f) => f.friend),
      ]);
    });
    const onVisible = () => {
      if (this.document.visibilityState === 'visible') this.store.markActiveRead();
    };
    this.document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => {
      this.document.removeEventListener('visibilitychange', onVisible);
      this.realtime.stop();
    });
  }

  public ngOnInit(): void {
    void this.store.load();
    void this.friends.load();
    this.realtime.start();
  }

  protected send(text: string, tray: AttachmentTrayComponent): void {
    this.store.send(text, tray.ready());
    tray.clear();
  }

  protected open(id: number): void {
    void this.store.select(id);
  }

  protected async chatWith(friendId: number): Promise<void> {
    await this.store.openWith(friendId);
    this.tab.set('chats');
  }

  protected async resetDemo(): Promise<void> {
    const ok = await this.confirm.ask({
      title: '¿Reiniciar la demo?',
      text: 'Se borran tus mensajes y cuentas de prueba y vuelves a los datos iniciales.',
      confirmLabel: 'Reiniciar',
      danger: true,
    });
    if (!ok) return;
    this.realtime.stop();
    this.demo?.reset();
    this.store.reset();
    this.friends.reset();
    this.presence.reset();
    this.auth.logout();
  }

  protected async logout(): Promise<void> {
    const ok = await this.confirm.ask({ title: '¿Cerrar sesión?', text: 'Tendrás que volver a iniciar sesión en este dispositivo.', confirmLabel: 'Cerrar sesión' });
    if (!ok) return;
    this.realtime.stop();
    this.store.reset();
    this.friends.reset();
    this.presence.reset();
    this.auth.logout();
  }
}
