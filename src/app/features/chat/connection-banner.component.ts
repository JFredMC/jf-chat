import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { RealtimeService } from './realtime.service';

/** Shown only after a short delay, so brief reconnections don't flicker. */
const SHOW_AFTER_MS = 1500;

@Component({
  selector: 'app-connection-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message(); as text) {
      <div class="pointer-events-auto flex items-center gap-3 rounded-full bg-gray-900/90 px-4 py-2 text-sm text-white shadow-lg backdrop-blur dark:bg-gray-700/95" role="status" data-testid="connection-banner">
        @if (canRetry()) {
          <span aria-hidden="true">⚠️</span>
        } @else {
          <span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true"></span>
        }
        <span>{{ text }}</span>
        @if (canRetry()) {
          <button type="button" class="font-semibold text-indigo-300 underline-offset-2 hover:underline" (click)="realtime.retry()">Reintentar</button>
        }
      </div>
    }
  `,
  host: { class: 'pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center px-4' },
})
export class ConnectionBannerComponent {
  protected readonly realtime = inject(RealtimeService);
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly browserOnline = signal(this.window?.navigator.onLine ?? true);
  private readonly delayed = signal(false);

  protected readonly canRetry = computed(() => this.browserOnline() && this.realtime.status() === 'offline');
  protected readonly message = computed(() => {
    if (!this.browserOnline()) return 'Sin conexión a internet';
    if (!this.delayed()) return null;
    switch (this.realtime.status()) {
      case 'connecting':
        return 'Conectando…';
      case 'reconnecting':
        return 'Reconectando…';
      case 'offline':
        return 'Sin conexión en tiempo real.';
      default:
        return null;
    }
  });

  public constructor() {
    const online = () => this.browserOnline.set(true);
    const offline = () => this.browserOnline.set(false);
    this.window?.addEventListener('online', online);
    this.window?.addEventListener('offline', offline);

    let timer: ReturnType<typeof setTimeout> | undefined;
    effect(() => {
      const status = this.realtime.status();
      clearTimeout(timer);
      this.delayed.set(false);
      if (status !== 'online' && status !== 'idle') timer = setTimeout(() => this.delayed.set(true), SHOW_AFTER_MS);
    });

    inject(DestroyRef).onDestroy(() => {
      clearTimeout(timer);
      this.window?.removeEventListener('online', online);
      this.window?.removeEventListener('offline', offline);
    });
  }
}
