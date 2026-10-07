import { ChangeDetectionStrategy, Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import type { SendOptions, UiMessage } from './chat.store';
import { EmojiPickerComponent } from './emoji-picker.component';
import { quoteText } from './quote';

export const MAX_MESSAGE_LENGTH = 4000;
const TYPING_REPEAT_MS = 4000;

/** Ephemeral choices offered in the composer (seconds; null = the normal 24 h). */
export const EPHEMERAL_CHOICES: { value: number | null; label: string; short: string }[] = [
  { value: null, label: 'Normal (24 h)', short: '' },
  { value: 60, label: '1 minuto', short: '1m' },
  { value: 600, label: '10 minutos', short: '10m' },
  { value: 3600, label: '1 hora', short: '1h' },
];

@Component({
  selector: 'app-composer',
  imports: [EmojiPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block border-t border-gray-200 bg-white px-3 py-2 sm:px-4 dark:border-gray-800 dark:bg-gray-900' },
  template: `
    @if (replyTo(); as quoted) {
      <div class="mb-2 flex items-center gap-2 rounded-xl border-l-4 border-cyan-400 bg-gray-100 px-3 py-1.5 dark:bg-gray-800" data-testid="reply-preview">
        <div class="min-w-0 flex-1 text-xs">
          <p class="font-semibold text-cyan-700 dark:text-cyan-300">Respondiendo a {{ replyName() }}</p>
          <p class="truncate text-gray-600 dark:text-gray-300">{{ quote(quoted) }}</p>
        </div>
        <button type="button" class="btn-icon h-8 w-8 text-sm" (click)="cancelReply.emit()" aria-label="Cancelar respuesta">✕</button>
      </div>
    }
    @if (options().expiresIn || options().viewOnce) {
      <p class="mb-1.5 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300" data-testid="ephemeral-hint">
        <span aria-hidden="true">{{ options().viewOnce ? '👁' : '⏱' }}</span>
        {{ options().viewOnce ? 'Ver una vez: desaparece 30 s después de que lo abra.' : 'Mensajes temporales: se destruyen a los ' + ephemeralLabel() + '.' }}
      </p>
    }
    <form class="relative flex items-end gap-1.5" (submit)="$event.preventDefault(); submit()">
      <ng-content select="[composerStart]" />
      <button type="button" class="btn-icon shrink-0" (click)="toggle('emoji')" [attr.aria-expanded]="panel() === 'emoji'" aria-label="Emojis" title="Emojis" data-testid="emoji-toggle">
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" stroke-linecap="round" /></svg>
      </button>
      <button type="button" class="btn-icon relative shrink-0" [class.text-amber-500]="options().expiresIn || options().viewOnce" (click)="toggle('timer')" [attr.aria-expanded]="panel() === 'timer'"
        aria-label="Mensajes temporales" title="Mensajes temporales" data-testid="ephemeral-toggle">
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" stroke-linecap="round" stroke-linejoin="round" /></svg>
        @if (badge()) {
          <span class="absolute -top-0.5 -right-0.5 rounded-full bg-amber-500 px-1 text-[0.6rem] leading-4 font-bold text-white">{{ badge() }}</span>
        }
      </button>
      @if (panel() === 'emoji') {
        <app-emoji-picker class="absolute bottom-full left-0 z-30 mb-2" (picked)="insert($event)" />
      }
      @if (panel() === 'timer') {
        <div class="absolute bottom-full left-0 z-30 mb-2 w-64 rounded-2xl bg-white p-2 shadow-2xl ring-1 ring-gray-900/10 dark:bg-gray-900 dark:ring-white/10" role="menu" aria-label="Mensajes temporales" data-testid="ephemeral-menu">
          <p class="px-2 pt-1 pb-2 text-xs text-gray-500">Todo se autodestruye en 24 h. Puedes acortarlo:</p>
          @for (choice of choices; track choice.label) {
            <button type="button" role="menuitemradio" [attr.aria-checked]="!options().viewOnce && options().expiresIn === choice.value"
              class="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
              (click)="choose({ expiresIn: choice.value, viewOnce: false })">
              {{ choice.label }}
              @if (!options().viewOnce && options().expiresIn === choice.value) {
                <span class="text-cyan-500" aria-hidden="true">✓</span>
              }
            </button>
          }
          <button type="button" role="menuitemradio" [attr.aria-checked]="options().viewOnce"
            class="mt-1 flex w-full items-center justify-between rounded-lg border-t border-gray-200 px-2 py-2 text-left text-sm hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-gray-800"
            (click)="choose({ expiresIn: null, viewOnce: !options().viewOnce })" data-testid="view-once">
            👁 Ver una vez
            @if (options().viewOnce) {
              <span class="text-cyan-500" aria-hidden="true">✓</span>
            }
          </button>
        </div>
      }
      <label for="composer-input" class="sr-only">Escribe un mensaje</label>
      <textarea
        #input
        id="composer-input"
        rows="1"
        class="max-h-40 min-h-11 min-w-0 flex-1 resize-none rounded-3xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-[0.95rem] text-gray-900 placeholder:text-gray-400 focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-400/30 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:bg-gray-800"
        placeholder="Escribe un mensaje"
        [value]="text()"
        [attr.maxlength]="max"
        (input)="onInput($event)"
        (keydown)="onKeydown($event)"
        (paste)="onPaste($event)"
        (blur)="stopTyping()"
        (focus)="panel.set(null)"
        autocomplete="off"
        autocorrect="on"
        enterkeyhint="send"
        data-testid="composer"
      ></textarea>
      <button type="submit" class="btn-icon shrink-0 bg-gradient-to-br from-cyan-500 to-indigo-500 text-white hover:text-white disabled:opacity-40" [disabled]="!canSend()" aria-label="Enviar mensaje" data-testid="send">
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
  /** Files pasted into the text box (e.g. a screenshot). */
  public readonly filesPasted = output<File[]>();
  public readonly replyTo = input<UiMessage | null>(null);
  public readonly replyName = input('');
  public readonly cancelReply = output();
  public readonly options = input<SendOptions>({ expiresIn: null, viewOnce: false });
  public readonly optionsChange = output<SendOptions>();

  protected readonly choices = EPHEMERAL_CHOICES;
  protected readonly panel = signal<'emoji' | 'timer' | null>(null);
  protected readonly quote = quoteText;
  protected readonly badge = computed(() =>
    this.options().viewOnce ? '1' : (EPHEMERAL_CHOICES.find((c) => c.value === this.options().expiresIn)?.short ?? ''),
  );
  protected readonly ephemeralLabel = computed(() => EPHEMERAL_CHOICES.find((c) => c.value === this.options().expiresIn)?.label ?? '');

  protected readonly max = MAX_MESSAGE_LENGTH;
  protected readonly text = signal('');
  protected readonly remaining = computed(() => MAX_MESSAGE_LENGTH - this.text().length);
  protected readonly canSend = computed(
    () => !this.disabled() && (this.text().trim().length > 0 || this.hasExtra()) && this.remaining() >= 0,
  );
  private readonly input = viewChild.required<ElementRef<HTMLTextAreaElement>>('input');
  private typingTimer?: ReturnType<typeof setTimeout>;
  private isTyping = false;
  private typingSentAt = 0;

  public focus(): void {
    this.input().nativeElement.focus();
  }

  protected toggle(panel: 'emoji' | 'timer'): void {
    this.panel.update((current) => (current === panel ? null : panel));
  }

  protected choose(options: SendOptions): void {
    this.optionsChange.emit(options);
    this.panel.set(null);
  }

  /** Inserts an emoji at the caret (the picker stays open for more). */
  protected insert(emoji: string): void {
    const element = this.input().nativeElement;
    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? start;
    const next = element.value.slice(0, start) + emoji + element.value.slice(end);
    if (next.length > MAX_MESSAGE_LENGTH) return;
    element.value = next;
    this.text.set(next);
    const caret = start + emoji.length;
    element.setSelectionRange(caret, caret);
    this.autosize(element);
  }

  protected onInput(event: Event): void {
    const element = event.target as HTMLTextAreaElement;
    this.text.set(element.value);
    this.autosize(element);
    if (element.value.trim()) {
      // Repeat "typing" every few seconds: the other side expires it after ~6 s.
      if (!this.isTyping || Date.now() - this.typingSentAt > TYPING_REPEAT_MS) {
        this.isTyping = true;
        this.typingSentAt = Date.now();
        this.typing.emit(true);
      }
      clearTimeout(this.typingTimer);
      this.typingTimer = setTimeout(() => this.stopTyping(), 3000);
    } else {
      this.stopTyping();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.panel()) this.panel.set(null);
      else if (this.replyTo()) this.cancelReply.emit();
      return;
    }
    // Enter sends, Shift+Enter adds a line (not while composing accents/IME).
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.submit();
    }
  }

  protected onPaste(event: ClipboardEvent): void {
    const files = Array.from(event.clipboardData?.files ?? []);
    if (!files.length) return;
    event.preventDefault();
    this.filesPasted.emit(files);
  }

  protected submit(): void {
    if (!this.canSend()) return;
    this.send.emit(this.text().trim());
    this.text.set('');
    const element = this.input().nativeElement;
    element.value = '';
    this.autosize(element);
    this.stopTyping();
    this.panel.set(null);
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
