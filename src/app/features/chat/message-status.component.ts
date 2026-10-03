import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { DeliveryState } from './chat.store';

const LABELS: Record<DeliveryState, string> = {
  sending: 'Enviando',
  failed: 'No enviado',
  sent: 'Enviado',
  delivered: 'Entregado',
  read: 'Leído',
};

@Component({
  selector: 'app-message-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="inline-flex items-center" [attr.title]="label()" [attr.aria-label]="label()" role="img" [attr.data-status]="state()">
      @switch (state()) {
        @case ('sending') {
          <svg viewBox="0 0 16 16" class="h-3.5 w-3.5 opacity-70" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="8" cy="8" r="6" />
            <path d="M8 4.5V8l2.5 1.5" stroke-linecap="round" />
          </svg>
        }
        @case ('failed') {
          <svg viewBox="0 0 16 16" class="h-3.5 w-3.5 text-red-500" fill="currentColor">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm-.75 3.5h1.5v4.5h-1.5V4.5Zm0 6h1.5V12h-1.5v-1.5Z" />
          </svg>
        }
        @case ('sent') {
          <svg viewBox="0 0 16 16" class="h-3.5 w-3.5 opacity-80" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="m3 8.5 3 3 7-7" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        }
        @default {
          <svg viewBox="0 0 20 16" class="h-3.5 w-[18px]" [class]="state() === 'read' ? 'text-sky-300' : 'opacity-80'" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="m1.5 8.5 3 3 7-7M8 11.5l7-7" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        }
      }
    </span>
  `,
})
export class MessageStatusComponent {
  public readonly state = input.required<DeliveryState>();
  protected readonly label = computed(() => LABELS[this.state()]);
}
