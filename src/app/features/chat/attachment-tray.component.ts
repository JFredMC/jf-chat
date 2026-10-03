import { HttpEventType } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import type { Subscription } from 'rxjs';
import { errorMessage } from '../../core/api-error';
import type { Attachment } from '../../core/models';
import { ToastService } from '../../core/ui/toast.service';
import { fileSizeLabel } from '../../shared/time';
import { ChatApi } from './chat.api';

/** Same rules as the API (file-validation.ts). */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain'];
export const MAX_FILES = 5;

interface DraftFile {
  key: number;
  name: string;
  size: number;
  isImage: boolean;
  preview: string | null;
  progress: number;
  attachment: Attachment | null;
  error: string | null;
  upload?: Subscription;
}

/** Validates a file before uploading; returns the problem in Spanish or null. */
export function fileProblem(file: Pick<File, 'type' | 'size' | 'name'>): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return `«${file.name}»: solo imágenes (JPG, PNG, GIF, WebP), PDF o texto`;
  if (file.size === 0) return `«${file.name}» está vacío`;
  if (file.size > MAX_FILE_BYTES) return `«${file.name}» supera el máximo de 10 MB`;
  return null;
}

/**
 * Files attached to the next message. They are uploaded right away (private
 * and pending until the message is sent); removing one deletes the upload.
 */
@Component({
  selector: 'app-attachment-tray',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input #picker type="file" class="hidden" multiple [accept]="accept" (change)="onPicked($event)" data-testid="file-input" aria-hidden="true" tabindex="-1" />
    @if (files().length) {
      <ul class="flex gap-2 overflow-x-auto border-t border-gray-200 bg-white px-3 pt-2 sm:px-4 dark:border-gray-800 dark:bg-gray-900" aria-label="Archivos adjuntos" data-testid="attachment-tray">
        @for (file of files(); track file.key) {
          <li class="relative flex w-44 shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800" [class.border-red-400]="file.error">
            @if (file.preview) {
              <img [src]="file.preview" alt="" class="h-10 w-10 rounded-lg object-cover" />
            } @else {
              <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-xl dark:bg-gray-900" aria-hidden="true">📄</span>
            }
            <span class="min-w-0 flex-1 text-xs">
              <span class="block truncate font-medium text-gray-800 dark:text-gray-100">{{ file.name }}</span>
              <span class="block truncate" [class]="file.error ? 'text-red-600' : 'text-gray-500'">
                {{ file.error ?? (file.attachment ? size(file.size) : 'Subiendo… ' + file.progress + '%') }}
              </span>
            </span>
            <button type="button" class="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-gray-700 text-xs text-white shadow" (click)="remove(file)" [attr.aria-label]="'Quitar ' + file.name">✕</button>
            @if (!file.attachment && !file.error) {
              <span class="absolute inset-x-2 bottom-1 h-0.5 overflow-hidden rounded bg-gray-200 dark:bg-gray-700" aria-hidden="true">
                <span class="block h-full bg-indigo-500 transition-all" [style.width.%]="file.progress"></span>
              </span>
            }
          </li>
        }
      </ul>
    }
  `,
})
export class AttachmentTrayComponent {
  private readonly api = inject(ChatApi);
  private readonly toast = inject(ToastService);
  public readonly conversationId = input.required<number>();

  protected readonly accept = ACCEPTED_TYPES.join(',');
  protected readonly files = signal<DraftFile[]>([]);
  private readonly picker = viewChild.required<ElementRef<HTMLInputElement>>('picker');
  private nextKey = 1;

  public readonly ready = computed(() => this.files().flatMap((f) => (f.attachment ? [f.attachment] : [])));
  public readonly busy = computed(() => this.files().some((f) => !f.attachment && !f.error));
  public readonly hasErrors = computed(() => this.files().some((f) => f.error));

  public constructor() {
    // Switching chats discards the draft (uploads are tied to a conversation).
    effect(() => {
      this.conversationId();
      untracked(() => this.discardAll());
    });
    inject(DestroyRef).onDestroy(() => this.discardAll());
  }

  public pick(): void {
    this.picker().nativeElement.click();
  }

  public addFiles(list: File[]): void {
    for (const file of list) {
      if (this.files().length >= MAX_FILES) {
        this.toast.error(`Puedes adjuntar hasta ${MAX_FILES} archivos por mensaje`);
        break;
      }
      const problem = fileProblem(file);
      if (problem) {
        this.toast.error(problem);
        continue;
      }
      this.upload(file);
    }
  }

  /** The message was sent: the attachments now belong to it. */
  public clear(): void {
    for (const file of this.files()) {
      file.upload?.unsubscribe();
      if (file.preview) URL.revokeObjectURL(file.preview);
    }
    this.files.set([]);
  }

  protected onPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addFiles(Array.from(input.files ?? []));
    input.value = '';
  }

  protected size(bytes: number): string {
    return fileSizeLabel(bytes);
  }

  protected remove(file: DraftFile): void {
    file.upload?.unsubscribe();
    if (file.preview) URL.revokeObjectURL(file.preview);
    if (file.attachment) this.api.discardAttachment(file.attachment.id).subscribe({ error: () => undefined });
    this.files.update((files) => files.filter((f) => f.key !== file.key));
  }

  private upload(file: File): void {
    const key = this.nextKey++;
    const isImage = file.type.startsWith('image/');
    const draft: DraftFile = {
      key,
      name: file.name,
      size: file.size,
      isImage,
      preview: isImage && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null,
      progress: 0,
      attachment: null,
      error: null,
    };
    this.files.update((files) => [...files, draft]);
    const patch = (changes: Partial<DraftFile>) =>
      this.files.update((files) => files.map((f) => (f.key === key ? { ...f, ...changes } : f)));

    const upload = this.api.uploadWithProgress(this.conversationId(), file).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) patch({ progress: Math.round((event.loaded / event.total) * 100) });
        if (event.type === HttpEventType.Response && event.body) patch({ attachment: event.body, progress: 100 });
      },
      error: (error: unknown) => patch({ error: errorMessage(error, 'No se pudo subir') }),
    });
    patch({ upload });
  }

  private discardAll(): void {
    for (const file of this.files()) {
      file.upload?.unsubscribe();
      if (file.preview) URL.revokeObjectURL(file.preview);
      if (file.attachment) this.api.discardAttachment(file.attachment.id).subscribe({ error: () => undefined });
    }
    if (this.files().length) this.files.set([]);
  }
}
