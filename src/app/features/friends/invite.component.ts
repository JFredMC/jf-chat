import { ChangeDetectionStrategy, Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { ToastService } from '../../core/ui/toast.service';
import { FriendsStore } from './friends.store';

/** "K7QM2XRP9D" → "K7QM-2XRP-9D" while typing; the API ignores separators. */
export const formatInviteInput = (value: string): string => {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  return [raw.slice(0, 4), raw.slice(4, 8), raw.slice(8)].filter(Boolean).join('-');
};

/** My single-use invite code: show, copy, rotate. */
@Component({
  selector: 'app-my-invite',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="rounded-2xl bg-gradient-to-br from-cyan-500/10 to-indigo-500/10 p-4 ring-1 ring-cyan-500/20" data-testid="my-invite">
      <p class="text-sm font-semibold">Tu código de invitación</p>
      <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Compártelo solo con tu pareja, en persona o por un canal seguro. Sirve una sola vez.</p>
      <div class="mt-3 flex items-center gap-2">
        <output class="flex-1 rounded-xl bg-white px-3 py-2 text-center font-mono text-lg font-semibold tracking-[0.2em] dark:bg-gray-950" data-testid="invite-code" aria-label="Tu código">{{ revealed() ? (friends.inviteCode() ?? '…') : '••••-••••-••' }}</output>
        <button type="button" class="btn-secondary px-3 py-2 text-xs" (click)="toggle()" data-testid="invite-reveal">{{ revealed() ? 'Ocultar' : 'Mostrar' }}</button>
      </div>
      <div class="mt-2 flex gap-2">
        <button type="button" class="btn-secondary flex-1 px-3 py-1.5 text-xs" (click)="copy()" [disabled]="!friends.inviteCode()" data-testid="invite-copy">Copiar</button>
        <button type="button" class="btn-secondary flex-1 px-3 py-1.5 text-xs" (click)="friends.rotateInvite()" [disabled]="friends.inviteBusy()" data-testid="invite-rotate">Generar otro</button>
      </div>
    </div>
  `,
})
export class MyInviteComponent implements OnInit {
  protected readonly friends = inject(FriendsStore);
  private readonly toast = inject(ToastService);
  protected readonly revealed = signal(false);

  public ngOnInit(): void {
    if (!this.friends.inviteCode()) void this.friends.loadInvite();
  }

  protected toggle(): void {
    this.revealed.update((v) => !v);
  }

  protected async copy(): Promise<void> {
    const code = this.friends.inviteCode();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      this.toast.success('Código copiado');
    } catch {
      this.revealed.set(true);
      this.toast.info('Cópialo a mano: ' + code);
    }
  }
}

/** Redeem someone else's code. */
@Component({
  selector: 'app-redeem-invite',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <form class="space-y-2" (submit)="$event.preventDefault(); submit()" data-testid="redeem-invite">
      <label class="label" [attr.for]="inputId">¿Te dieron un código?</label>
      <div class="flex gap-2">
        <input
          [id]="inputId"
          class="input flex-1 font-mono tracking-widest uppercase"
          placeholder="XXXX-XXXX-XX"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          inputmode="text"
          maxlength="12"
          [value]="code()"
          (input)="onInput($event)"
          data-testid="redeem-input"
        />
        <button type="submit" class="btn-primary px-4" [disabled]="!ready() || busy()" data-testid="redeem-submit">
          {{ busy() ? '…' : 'Agregar' }}
        </button>
      </div>
    </form>
  `,
})
export class RedeemInviteComponent {
  private static seq = 0;
  private readonly friends = inject(FriendsStore);
  public readonly added = output<number>();
  protected readonly inputId = `redeem-${++RedeemInviteComponent.seq}`;
  protected readonly code = signal('');
  protected readonly busy = signal(false);
  protected readonly ready = computed(() => this.code().replace(/-/g, '').length >= 8);

  protected onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatInviteInput(input.value);
    input.value = formatted;
    this.code.set(formatted);
  }

  protected async submit(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    const friendship = await this.friends.redeem(this.code());
    this.busy.set(false);
    if (friendship) {
      this.code.set('');
      this.added.emit(friendship.friend.id);
    }
  }
}
