import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { BrandService } from '../core/ui/brand.service';

export const PORTFOLIO_URL = 'https://jfredmc.github.io/portfolio/';

/** Velo mark (a V under a veil) or the "Notas" glyph when disguised. */
@Component({
  selector: 'app-brand-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (brand.disguised()) {
      <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill="#f4f1ea" />
        <path d="M18 22h28M18 32h28M18 42h18" stroke="#8b7f6a" stroke-width="4" stroke-linecap="round" />
      </svg>
    } @else {
      <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient [attr.id]="gradientId" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#22d3ee" />
            <stop offset="1" stop-color="#818cf8" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="#070d18" />
        <path d="M15 21q17-11 34 0" fill="none" [attr.stroke]="stroke" stroke-width="3.5" stroke-linecap="round" opacity=".55" />
        <path d="M19 26l13 19 13-19" fill="none" [attr.stroke]="stroke" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    }
  `,
  host: { class: 'inline-flex shrink-0' },
})
export class BrandLogoComponent {
  private static seq = 0;
  protected readonly brand = inject(BrandService);
  public readonly size = input(36);
  protected readonly gradientId = `velo-g-${++BrandLogoComponent.seq}`;
  protected readonly stroke = `url(#${this.gradientId})`;
}

/** Discreet author mark: opens the portfolio in a new tab, never in the app. */
@Component({
  selector: 'app-jfred-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      [href]="url"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-gray-500 ring-1 ring-gray-900/10 transition hover:text-cyan-600 hover:ring-cyan-400/50 dark:text-gray-400 dark:ring-white/10 dark:hover:text-cyan-300"
      [attr.aria-label]="label()"
    >
      por <span class="font-semibold">JFredDev</span>
    </a>
  `,
})
export class JfredMarkComponent {
  protected readonly url = PORTFOLIO_URL;
  protected readonly label = computed(() => 'por JFredDev (abre el portafolio en una pestaña nueva)');
}
