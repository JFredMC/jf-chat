import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../auth/auth.store';
import { ConfirmService } from '../ui/confirm.service';
import { BrandService } from '../ui/brand.service';
import { BrandLogoComponent } from '../../shared/brand.component';
import { MAX_PIN_FAILURES, PinLockService } from './pin-lock.service';
import { ShieldService } from './shield.service';

/**
 * Lock screen and screenshot shield. Rendered as a modal <dialog> so it sits
 * in the top layer, above any other open dialog.
 */
@Component({
  selector: 'app-privacy-overlay',
  imports: [FormsModule, BrandLogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      class="privacy-overlay m-0 h-dvh max-h-none w-screen max-w-none bg-[#070d18] p-0 text-white backdrop:bg-[#070d18]"
      (cancel)="$event.preventDefault()"
      [attr.aria-label]="mode() === 'lock' ? 'Bloqueado' : 'Contenido oculto'"
    >
      @if (mode() === 'lock') {
        <form class="mx-auto flex h-full max-w-xs flex-col items-center justify-center gap-5 px-6 text-center" (ngSubmit)="submit()" data-testid="lock-screen">
          <app-brand-logo [size]="56" />
          <div>
            <h2 class="font-display text-xl font-semibold">{{ brand.name() }} está bloqueado</h2>
            <p class="mt-1 text-sm text-gray-400">Introduce tu PIN para continuar.</p>
          </div>
          <input
            #pinInput
            name="pin"
            type="password"
            inputmode="numeric"
            autocomplete="off"
            maxlength="8"
            class="h-14 w-full rounded-2xl border border-white/10 bg-white/5 text-center text-2xl tracking-[0.5em] text-white outline-none focus:border-cyan-400"
            aria-label="PIN"
            [(ngModel)]="pin"
            [disabled]="busy()"
            data-testid="lock-pin"
          />
          @if (error()) {
            <p class="text-sm text-rose-300" role="alert" data-testid="lock-error">{{ error() }}</p>
          }
          <button type="submit" class="h-12 w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-indigo-400 font-semibold text-[#070d18] disabled:opacity-60" [disabled]="busy() || pin.length < 4" data-testid="lock-submit">
            {{ busy() ? 'Comprobando…' : 'Desbloquear' }}
          </button>
          <button type="button" class="text-xs text-gray-400 underline-offset-2 hover:underline" (click)="forgot()" data-testid="lock-forgot">Olvidé mi PIN</button>
        </form>
      } @else if (mode() === 'shield') {
        <button type="button" class="flex h-full w-full flex-col items-center justify-center gap-3 text-center" (click)="shield.reveal()" data-testid="privacy-shield">
          <app-brand-logo [size]="48" />
          <span class="text-sm text-gray-400">Contenido oculto · toca para volver</span>
        </button>
      }
    </dialog>
  `,
})
export class PrivacyOverlayComponent {
  protected readonly auth = inject(AuthStore);
  protected readonly lock = inject(PinLockService);
  protected readonly shield = inject(ShieldService);
  protected readonly brand = inject(BrandService);
  private readonly confirm = inject(ConfirmService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly pinInput = viewChild<ElementRef<HTMLInputElement>>('pinInput');

  protected pin = '';
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly mode = computed<'lock' | 'shield' | null>(() => {
    if (this.lock.locked()) return 'lock';
    if (this.shield.hidden() && this.auth.isAuthenticated()) return 'shield';
    return null;
  });

  public constructor() {
    effect(() => {
      const mode = this.mode();
      const dialog = this.dialog().nativeElement;
      if (mode) {
        // Re-open to move it above any dialog opened meanwhile.
        if (dialog.open) dialog.close();
        dialog.showModal();
        if (mode === 'lock') queueMicrotask(() => this.pinInput()?.nativeElement.focus());
      } else if (dialog.open) {
        dialog.close();
      }
    });
  }

  protected async submit(): Promise<void> {
    if (this.busy() || this.pin.length < 4) return;
    this.busy.set(true);
    this.error.set(null);
    const result = await this.lock.unlock(this.pin);
    this.busy.set(false);
    this.pin = '';
    if (result === 'wrong') {
      const left = MAX_PIN_FAILURES - this.lock.failures();
      this.error.set(`PIN incorrecto. ${left === 1 ? 'Queda 1 intento' : `Quedan ${left} intentos`} antes de borrar los datos.`);
      queueMicrotask(() => this.pinInput()?.nativeElement.focus());
    }
  }

  protected async forgot(): Promise<void> {
    // Opened later, the confirmation dialog stacks above the lock screen.
    const ok = await this.confirm.ask({
      title: '¿Olvidaste tu PIN?',
      text: 'Se cerrará la sesión y se borrarán los datos de este dispositivo. Podrás entrar de nuevo con tu usuario y contraseña.',
      confirmLabel: 'Borrar y salir',
      danger: true,
    });
    if (ok) await this.lock.forget();
  }
}
