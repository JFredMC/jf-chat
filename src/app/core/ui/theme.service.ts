import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';

export type Theme = 'light' | 'dark';
const KEY = 'velo.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly theme = signal<Theme>(this.initial());
  public readonly isDark = computed(() => this.theme() === 'dark');

  public constructor() {
    effect(() => {
      const theme = this.theme();
      this.document.documentElement.classList.toggle('dark', theme === 'dark');
      this.document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#070d18' : '#f5f7fb');
      try {
        localStorage.setItem(KEY, theme);
      } catch {
        /* private mode */
      }
    });
  }

  public toggle(): void {
    this.theme.update((theme) => (theme === 'dark' ? 'light' : 'dark'));
  }

  private initial(): Theme {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      /* private mode */
    }
    // Dark by default: discreet in a dim room and true to the brand.
    return 'dark';
  }
}
