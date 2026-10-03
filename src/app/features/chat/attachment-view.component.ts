import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import type { Attachment } from '../../core/models';
import { ToastService } from '../../core/ui/toast.service';
import { fileSizeLabel } from '../../shared/time';
import { ChatApi } from './chat.api';

/** Images and files are private: a short-lived signed URL is requested on demand. */
@Component({
  selector: 'app-attachment-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (attachment().is_image) {
      @if (url(); as src) {
        <a [href]="src" target="_blank" rel="noopener noreferrer" class="block">
          <img [src]="src" [alt]="attachment().file_name" class="max-h-64 w-full max-w-xs rounded-lg object-cover" loading="lazy" (error)="url.set(null)" />
        </a>
      } @else {
        <button type="button" (click)="load()" class="flex h-32 w-56 max-w-full items-center justify-center rounded-lg bg-black/10 text-sm dark:bg-white/10" [disabled]="busy()">
          {{ busy() ? 'Cargando…' : '🖼️ Ver imagen' }}
        </button>
      }
    } @else {
      <button type="button" (click)="open()" class="flex w-full max-w-xs items-center gap-3 rounded-lg bg-black/10 px-3 py-2 text-left dark:bg-white/10" [disabled]="busy()">
        <span class="text-2xl" aria-hidden="true">{{ attachment().file_type === 'application/pdf' ? '📕' : '📄' }}</span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-medium">{{ attachment().file_name }}</span>
          <span class="block text-xs opacity-70">{{ size() }}</span>
        </span>
        <span class="text-xs underline">{{ busy() ? '…' : 'Abrir' }}</span>
      </button>
    }
  `,
})
export class AttachmentViewComponent implements OnInit {
  private readonly api = inject(ChatApi);
  private readonly toast = inject(ToastService);
  public readonly attachment = input.required<Attachment>();
  /** Load images right away (they are in view when rendered). */
  public readonly autoload = input(true);

  protected readonly url = signal<string | null>(null);
  protected readonly busy = signal(false);

  public ngOnInit(): void {
    if (this.attachment().is_image && this.autoload() && this.attachment().id > 0) this.load();
  }

  protected size(): string {
    return fileSizeLabel(this.attachment().file_size);
  }

  protected load(): void {
    this.busy.set(true);
    this.api.attachmentUrl(this.attachment().id).subscribe({
      next: ({ url }) => {
        this.url.set(url);
        this.busy.set(false);
      },
      error: () => {
        this.busy.set(false);
        this.toast.error('No se pudo cargar el archivo');
      },
    });
  }

  protected open(): void {
    // Open the tab synchronously (popup blockers), then point it to the signed URL.
    const tab = window.open('', '_blank', 'noopener');
    this.busy.set(true);
    this.api.attachmentUrl(this.attachment().id).subscribe({
      next: ({ url }) => {
        this.busy.set(false);
        if (tab) tab.location.href = url;
        else window.location.assign(url);
      },
      error: () => {
        tab?.close();
        this.busy.set(false);
        this.toast.error('No se pudo abrir el archivo');
      },
    });
  }
}
