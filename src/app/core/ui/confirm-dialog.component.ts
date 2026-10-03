import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { ConfirmService } from './confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      class="m-auto w-[min(26rem,calc(100%-2rem))] rounded-2xl bg-white p-0 text-gray-900 shadow-2xl backdrop:bg-black/50 dark:bg-gray-800 dark:text-gray-100"
      aria-labelledby="confirm-title"
      (cancel)="confirm.answer(false)"
    >
      @if (confirm.request(); as request) {
        <div class="p-6">
          <h2 id="confirm-title" class="text-lg font-semibold">{{ request.title }}</h2>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">{{ request.text }}</p>
          <div class="mt-6 flex justify-end gap-2">
            <button type="button" class="btn-secondary" (click)="confirm.answer(false)">Cancelar</button>
            <button type="button" [class]="request.danger ? 'btn-danger' : 'btn-primary'" (click)="confirm.answer(true)">
              {{ request.confirmLabel }}
            </button>
          </div>
        </div>
      }
    </dialog>
  `,
})
export class ConfirmDialogComponent {
  protected readonly confirm = inject(ConfirmService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  public constructor() {
    effect(() => {
      const element = this.dialog().nativeElement;
      if (this.confirm.request()) {
        if (!element.open) element.showModal();
      } else if (element.open) {
        element.close();
      }
    });
  }
}
