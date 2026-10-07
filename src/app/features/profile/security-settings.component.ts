import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PIN_PATTERN } from '../../core/auth/session-vault';
import { LOCK_CHOICES, PinLockService } from '../../core/privacy/pin-lock.service';
import { PushNotificationsService } from '../../core/privacy/push.service';
import { ToastService } from '../../core/ui/toast.service';
import { BrandLogoComponent } from '../../shared/brand.component';

/** Device security: PIN lock and content-free notifications. */
@Component({
  selector: 'app-security-settings',
  imports: [FormsModule, BrandLogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-3 border-t border-gray-200 pt-6 dark:border-gray-800" aria-labelledby="pin-title" data-testid="pin-section">
      <h3 id="pin-title" class="font-semibold">Bloqueo con PIN</h3>
      @if (lock.enabled()) {
        <p class="text-xs text-gray-500">Activo. Velo pide el PIN al abrir y tras un rato sin uso. La sesión guardada en este dispositivo está cifrada con tu PIN.</p>
        <label class="flex items-center justify-between gap-4 text-sm">
          <span>Bloquear tras</span>
          <select class="input h-10 w-40" [ngModel]="lock.minutes()" (ngModelChange)="lock.setMinutes(+$event)" name="lock-minutes" data-testid="lock-minutes">
            @for (choice of choices; track choice.minutes) {
              <option [value]="choice.minutes">{{ choice.label }}</option>
            }
          </select>
        </label>
        <form class="flex items-end gap-2" (ngSubmit)="removePin()">
          <label class="min-w-0 flex-1">
            <span class="label">PIN actual</span>
            <input class="input" type="password" inputmode="numeric" maxlength="8" autocomplete="off" name="current" [(ngModel)]="current" data-testid="pin-current" />
          </label>
          <button type="submit" class="btn-secondary" [disabled]="busy() || current.length < 4" data-testid="pin-remove">Quitar PIN</button>
        </form>
      } @else {
        <p class="text-xs text-gray-500">Pide un PIN de 4 a 8 cifras al abrir Velo y tras un rato sin uso. Si alguien falla 5 veces, se borran los datos de este dispositivo.</p>
        <form class="grid grid-cols-2 gap-2" (ngSubmit)="setPin()">
          <label>
            <span class="label">Nuevo PIN</span>
            <input class="input" type="password" inputmode="numeric" maxlength="8" autocomplete="off" name="pin" [(ngModel)]="pin" data-testid="pin-new" />
          </label>
          <label>
            <span class="label">Repítelo</span>
            <input class="input" type="password" inputmode="numeric" maxlength="8" autocomplete="off" name="confirm" [(ngModel)]="confirm" data-testid="pin-confirm" />
          </label>
          <button type="submit" class="btn-primary col-span-2" [disabled]="busy()" data-testid="pin-save">{{ busy() ? 'Cifrando…' : 'Activar PIN' }}</button>
        </form>
      }
    </section>

    <section class="space-y-3 border-t border-gray-200 pt-6 dark:border-gray-800" aria-labelledby="push-title" data-testid="push-section">
      <div class="flex items-start justify-between gap-4">
        <span>
          <h3 id="push-title" class="font-semibold">Avisos discretos</h3>
          <span class="block text-xs text-gray-500">Solo si te escriben tras 6 horas de silencio. El aviso muestra un código al azar: ni quién, ni qué.</span>
        </span>
        <input type="checkbox" class="switch mt-1" [checked]="push.state() === 'on'" [disabled]="push.state() === 'busy' || push.state() === 'unsupported'"
          (change)="togglePush($any($event.target).checked)" aria-labelledby="push-title" data-testid="push-toggle" />
      </div>
      @if (hint(); as text) {
        <p class="text-xs text-amber-700 dark:text-amber-300" data-testid="push-hint">{{ text }}</p>
      }
      <div class="flex items-center gap-3 rounded-xl bg-gray-100 p-3 dark:bg-gray-800" aria-label="Así se ve un aviso" data-testid="push-preview">
        <app-brand-logo [size]="32" />
        <span class="min-w-0 text-sm">
          <span class="block font-semibold tabular-nums">{{ sample }}</span>
          <span class="block text-xs text-gray-500">Así se ve un aviso</span>
        </span>
      </div>
    </section>
  `,
})
export class SecuritySettingsComponent implements OnInit {
  protected readonly lock = inject(PinLockService);
  protected readonly push = inject(PushNotificationsService);
  private readonly toast = inject(ToastService);
  protected readonly choices = LOCK_CHOICES;
  protected readonly busy = signal(false);
  protected readonly sample = String(Math.floor(100000 + Math.random() * 900000));
  protected pin = '';
  protected confirm = '';
  protected current = '';

  protected readonly hint = computed(() => {
    switch (this.push.state()) {
      case 'unsupported':
        return 'Este navegador no admite avisos. En iPhone, añade Velo a la pantalla de inicio primero.';
      case 'denied':
        return 'Los avisos están bloqueados en los ajustes del navegador.';
      case 'unavailable':
        return 'Los avisos no están disponibles aquí (en la demo no se envían).';
      default:
        return null;
    }
  });

  public ngOnInit(): void {
    void this.push.refresh();
  }

  protected async setPin(): Promise<void> {
    if (!PIN_PATTERN.test(this.pin)) return this.toast.error('El PIN debe tener de 4 a 8 cifras');
    if (this.pin !== this.confirm) return this.toast.error('Los PIN no coinciden');
    this.busy.set(true);
    try {
      await this.lock.enable(this.pin);
      this.toast.success('PIN activado');
    } catch {
      this.toast.error('No se pudo activar el PIN');
    } finally {
      this.pin = this.confirm = '';
      this.busy.set(false);
    }
  }

  protected async removePin(): Promise<void> {
    this.busy.set(true);
    const ok = await this.lock.disable(this.current);
    this.busy.set(false);
    this.current = '';
    if (ok) this.toast.success('PIN quitado');
    else this.toast.error('PIN incorrecto');
  }

  protected async togglePush(on: boolean): Promise<void> {
    if (!on) {
      await this.push.disable();
      return;
    }
    const state = await this.push.enable();
    if (state === 'on') this.toast.success('Avisos discretos activados');
  }
}
