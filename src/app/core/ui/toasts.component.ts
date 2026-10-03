import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toasts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-3" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div
          class="pointer-events-auto flex max-w-md items-start gap-3 rounded-xl px-4 py-3 text-sm shadow-lg ring-1"
          [class]="
            toast.kind === 'error'
              ? 'bg-red-50 text-red-800 ring-red-200 dark:bg-red-950 dark:text-red-100 dark:ring-red-900'
              : toast.kind === 'success'
                ? 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:ring-emerald-900'
                : 'bg-white text-gray-800 ring-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700'
          "
          [attr.role]="toast.kind === 'error' ? 'alert' : 'status'"
        >
          <span class="flex-1">{{ toast.text }}</span>
          <button type="button" class="opacity-60 hover:opacity-100" (click)="toasts.dismiss(toast.id)" aria-label="Cerrar aviso">✕</button>
        </div>
      }
    </div>
  `,
})
export class ToastsComponent {
  protected readonly toasts = inject(ToastService);
}
