import { ChangeDetectionStrategy, Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';

export const MAX_MESSAGE_LENGTH = 4000;

@Component({
  selector: 'app-composer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block border-t border-gray-200 bg-white px-3 py-2 sm:px-4 dark:border-gray-800 dark:bg-gray-900' },
  template: `
    <form class="flex items-end gap-2" (submit)="$event.preventDefault(); submit()">
      <ng-content select="[composerStart]" />
      <label for="composer-input" class="sr-only">Escribe un mensaje</label>
      <textarea
        #input
        id="composer-input"
        rows="1"
        class="max-h-40 min-h-11 flex-1 resize-none rounded-2xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-[0.95rem] text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/30 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:bg-gray-800"
        placeholder="Escribe un mensaje"
        [value]="text()"
        [attr.maxlength]="max"
        (input)="onInput($event)"
        (keydown)="onKeydown($event)"
        (blur)="stopTyping()"
        enterkeyhint="send"
        data-testid="composer"
      ></textarea>
      <button type="submit" class="btn-icon bg-gradient-to-br from-blue-600 to-violet-600 text-white hover:text-white disabled:opacity-40" [disabled]="!canSend()" aria-label="Enviar mensaje" data-testid="send">
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6l-.01 6.53L15 12 3.39 13.87z" /></svg>
      </button>
    </form>
    @if (remaining() < 200) {
      <p class="mt-1 text-right text-xs" [class]="remaining() < 0 ? 'text-red-600' : 'text-gray-500'">{{ remaining() }} caracteres restantes</p>
    }
  `,
})
export class ComposerComponent {
  /** Extra content (e.g. attachments) makes an empty text sendable. */
  public readonly hasExtra = input(false);
  public readonly disabled = input(false);
  public readonly send = output<string>();
  public readonly typing = output<boolean>();

  protected readonly max = MAX_MESSAGE_LENGTH;
  protected readonly text = signal('');
  protected readonly remaining = computed(() => MAX_MESSAGE_LENGTH - this.text().length);
  protected readonly canSend = computed(
    () => !this.disabled() && (this.text().trim().length > 0 || this.hasExtra()) && this.remaining() >= 0,
  );
  private readonly input = viewChild.required<ElementRef<HTMLTextAreaElement>>('input');
  private typingTimer?: ReturnType<typeof setTimeout>;
  private isTyping = false;

  public focus(): void {
    this.input().nativeElement.focus();
  }

  protected onInput(event: Event): void {
    const element = event.target as HTMLTextAreaElement;
    this.text.set(element.value);
    this.autosize(element);
    if (element.value.trim()) {
      if (!this.isTyping) {
        this.isTyping = true;
        this.typing.emit(true);
      }
      clearTimeout(this.typingTimer);
      this.typingTimer = setTimeout(() => this.stopTyping(), 3000);
    } else {
      this.stopTyping();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    // Enter sends, Shift+Enter adds a line (not while composing accents/IME).
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.submit();
    }
  }

  protected submit(): void {
    if (!this.canSend()) return;
    this.send.emit(this.text().trim());
    this.text.set('');
    const element = this.input().nativeElement;
    element.value = '';
    this.autosize(element);
    this.stopTyping();
    element.focus();
  }

  protected stopTyping(): void {
    clearTimeout(this.typingTimer);
    if (this.isTyping) {
      this.isTyping = false;
      this.typing.emit(false);
    }
  }

  private autosize(element: HTMLTextAreaElement): void {
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
  }
}
