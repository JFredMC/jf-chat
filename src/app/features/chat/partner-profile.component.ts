import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { displayName, type User } from '../../core/models';
import { AvatarComponent } from '../../shared/avatar.component';
import { FriendsStore } from '../friends/friends.store';
import { ChatApi } from './chat.api';
import { PresenceStore } from './presence.store';

const SINCE = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

/** The other person's profile, opened from the chat header. */
@Component({
  selector: 'app-partner-profile',
  imports: [AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      class="m-auto w-[min(24rem,calc(100%-2rem))] rounded-3xl bg-white p-0 text-gray-900 shadow-2xl backdrop:bg-black/60 dark:bg-gray-900 dark:text-gray-100"
      aria-labelledby="partner-title"
      (close)="open.set(false)"
      data-testid="partner-profile"
    >
      @if (person(); as person) {
        <div class="relative bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 px-6 pt-8 pb-5 text-center">
          <button type="button" class="btn-icon absolute top-3 right-3" (click)="open.set(false)" aria-label="Cerrar">✕</button>
          <app-avatar class="mx-auto block w-fit" [user]="person" [size]="96" [online]="presence.isOnline(person.id)" />
          <h2 id="partner-title" class="mt-3 text-xl font-semibold">{{ name() }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400" data-testid="partner-presence">{{ presence.label(person.id, person.last_seen, !!person.hide_last_seen) }}</p>
          @if (person.status_message) {
            <p class="mt-2 text-sm italic text-gray-700 dark:text-gray-200" data-testid="partner-status">«{{ person.status_message }}»</p>
          }
        </div>
        <div class="space-y-4 px-6 py-5 text-sm">
          <ul class="space-y-2 text-gray-600 dark:text-gray-300">
            @if (since(); as since) {
              <li class="flex items-center gap-2"><span aria-hidden="true">🤝</span> Contacto desde el {{ since }}</li>
            }
            <li class="flex items-center gap-2"><span aria-hidden="true">⏳</span> Cada mensaje se autodestruye a las 24 h</li>
            @if (person.hide_last_seen) {
              <li class="flex items-center gap-2"><span aria-hidden="true">🙈</span> Oculta su última conexión</li>
            }
            @if (person.hide_typing) {
              <li class="flex items-center gap-2"><span aria-hidden="true">🤐</span> No muestra cuándo escribe</li>
            }
          </ul>
          <button type="button" class="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 font-semibold text-white hover:bg-rose-500" (click)="destroy.emit()" data-testid="partner-destroy">
            🔥 Autodestruir el chat
          </button>
        </div>
      }
    </dialog>
  `,
})
export class PartnerProfileComponent {
  private readonly api = inject(ChatApi);
  private readonly friends = inject(FriendsStore);
  protected readonly presence = inject(PresenceStore);
  public readonly user = input<User | null | undefined>(null);
  public readonly open = model(false);
  public readonly destroy = output();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  /** Fresh copy from the API when opened (status or privacy may have changed). */
  private readonly fresh = signal<User | null>(null);
  protected readonly person = computed(() => {
    const base = this.user();
    const fresh = this.fresh();
    return base && fresh?.id === base.id ? { ...base, ...fresh } : base;
  });
  protected readonly name = computed(() => displayName(this.person()));
  protected readonly since = computed(() => {
    const id = this.person()?.id;
    const friendship = this.friends.friends().find((f) => f.friend.id === id);
    return friendship?.created_at ? SINCE.format(new Date(friendship.created_at)) : null;
  });

  public constructor() {
    effect(() => {
      const element = this.dialog().nativeElement;
      if (this.open()) {
        if (!element.open) element.showModal();
        const id = untracked(() => this.user()?.id);
        if (id !== undefined) void this.refresh(id);
      } else if (element.open) {
        element.close();
      }
    });
  }

  private async refresh(id: number): Promise<void> {
    try {
      this.fresh.set(await firstValueFrom(this.api.user(id)));
    } catch {
      /* the cached copy is good enough */
    }
  }
}
