import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IS_DEMO } from '../../core/config';
import { ThemeService } from '../../core/ui/theme.service';

@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main
      class="relative flex min-h-dvh items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-100 p-4 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950"
    >
      <button
        type="button"
        class="btn-icon absolute top-4 right-4"
        (click)="theme.toggle()"
        [attr.aria-label]="theme.isDark() ? 'Usar tema claro' : 'Usar tema oscuro'"
      >
        {{ theme.isDark() ? '☀️' : '🌙' }}
      </button>
      <div class="w-full max-w-md">
        <div class="mb-6 flex flex-col items-center text-center">
          <div
            class="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 text-xl font-bold text-white shadow-lg shadow-indigo-500/30"
            aria-hidden="true"
          >
            JF
          </div>
          <p class="text-sm font-semibold tracking-wide text-indigo-600 dark:text-indigo-400">JfChat</p>
        </div>
        @if (isDemo) {
          <p class="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-900">
            <strong>Modo demo:</strong> todo funciona en tu navegador, sin servidor. Usa <code>demo</code> / <code>Demo1234</code> o crea una cuenta.
          </p>
        }
        <div class="rounded-2xl bg-white p-6 shadow-xl ring-1 ring-gray-900/5 sm:p-8 dark:bg-gray-900 dark:ring-white/10">
          <router-outlet />
        </div>
      </div>
    </main>
  `,
})
export class AuthLayoutComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly isDemo = inject(IS_DEMO);
}
