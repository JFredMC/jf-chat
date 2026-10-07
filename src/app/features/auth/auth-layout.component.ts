import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IS_DEMO } from '../../core/config';
import { BrandService } from '../../core/ui/brand.service';
import { ThemeService } from '../../core/ui/theme.service';
import { BrandLogoComponent, JfredMarkComponent } from '../../shared/brand.component';

@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, BrandLogoComponent, JfredMarkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main
      class="relative flex min-h-dvh items-center justify-center bg-gradient-to-br from-gray-50 via-cyan-50/40 to-indigo-100 p-4 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900"
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
          <app-brand-logo [size]="56" class="mb-3 rounded-2xl shadow-lg shadow-cyan-500/20" />
          <p class="font-display text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ brand.name() }}</p>
          @if (!brand.disguised()) {
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Solo ustedes dos. Nada queda.</p>
          }
        </div>
        @if (isDemo) {
          <p class="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-900">
            <strong>Modo demo:</strong> todo funciona en tu navegador, sin servidor. Usa <code>demo</code> / <code>Demo1234</code>, o crea una cuenta y conecta con el código <code>LUNA-DEMO-26</code>.
          </p>
        }
        <div class="rounded-2xl bg-white p-6 shadow-xl ring-1 ring-gray-900/5 sm:p-8 dark:bg-gray-900 dark:ring-white/10">
          <router-outlet />
        </div>
        <div class="mt-6 flex justify-center"><app-jfred-mark /></div>
      </div>
    </main>
  `,
})
export class AuthLayoutComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly brand = inject(BrandService);
  protected readonly isDemo = inject(IS_DEMO);
}
