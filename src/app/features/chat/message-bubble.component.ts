import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { displayName } from '../../core/models';
import { timeLabel } from '../../shared/time';
import { SecureMediaComponent } from './secure-media.component';
import { DEFAULT_RETENTION_SECONDS, deadlineOf, type DeliveryState, type UiMessage } from './chat.store';
import { linkify } from './linkify';
import { MessageStatusComponent } from './message-status.component';
import { quoteText } from './quote';

const SWIPE_TO_REPLY_PX = 56;
const SHOW_COUNTDOWN_MS = 60 * 60_000;

/** "0:45", "12:03", "1:00:00": time left before the message self-destructs. */
export function countdownLabel(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

@Component({
  selector: 'app-message-bubble',
  imports: [MessageStatusComponent, SecureMediaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'group/msg relative flex w-full',
    '[class.justify-end]': 'mine()',
    '[class.mt-3]': 'first()',
    '[class.mt-0.5]': '!first()',
    '[attr.id]': "'msg-' + message().id",
  },
  template: `
    <div
      class="relative flex max-w-[82%] flex-col sm:max-w-[68%]"
      [class.items-end]="mine()"
      [class.items-start]="!mine()"
      [style.transform]="swipe() ? 'translateX(' + swipe() + 'px)' : null"
      (pointerdown)="swipeStart($event)"
      (pointermove)="swipeMove($event)"
      (pointerup)="swipeEnd()"
      (pointercancel)="swipeEnd()"
    >
      @if (showSender() && first() && !mine()) {
        <span class="mb-0.5 px-3 text-xs font-medium text-cyan-600 dark:text-cyan-400">{{ senderName() }}</span>
      }
      <div
        class="bubble relative px-3 pt-1.5 pb-1 text-[0.94rem] leading-snug shadow-sm"
        [class]="bubbleClass()"
        [class.opacity-70]="message().pending"
        [class.bubble-tail-mine]="mine() && last()"
        [class.bubble-tail-theirs]="!mine() && last()"
        data-testid="message"
        [attr.data-mine]="mine()"
        [attr.data-ephemeral]="!!deadlineSoon() || null"
        (contextmenu)="$event.preventDefault()"
        (dblclick)="reply.emit()"
      >
        @if (message().reply_to; as quoted) {
          <button
            type="button"
            class="mb-1 block w-full rounded-lg border-l-4 px-2 py-1 text-left text-xs"
            [class]="mine() ? 'border-white/70 bg-white/15' : 'border-cyan-400 bg-gray-100 dark:bg-gray-900/60'"
            (click)="jump.emit(quoted.id)"
            data-testid="reply-quote"
          >
            <span class="block font-semibold" [class]="mine() ? 'text-white' : 'text-cyan-700 dark:text-cyan-300'">{{ quotedName() }}</span>
            <span class="line-clamp-2 opacity-90">{{ quote(quoted) }}</span>
          </button>
        } @else if (message().reply_to_id) {
          <p class="mb-1 rounded-lg px-2 py-1 text-xs italic opacity-70" data-testid="reply-quote-gone">Respondía a un mensaje que ya se autodestruyó</p>
        }
        @if (message().attachments?.length) {
          <div class="mb-1 flex flex-col gap-1.5">
            @for (attachment of message().attachments; track attachment.id) {
              <app-secure-media [attachment]="attachment" />
            }
          </div>
        }
        @if (message().content) {
          @if (hiddenUntilHeld() && !holding()) {
            <button
              type="button"
              class="flex items-center gap-2 py-1 text-sm font-medium select-none"
              (pointerdown)="hold($event)"
              (pointerup)="holding.set(false)"
              (pointerleave)="holding.set(false)"
              (keydown.space)="holding.set(true)"
              (keyup.space)="holding.set(false)"
              data-testid="view-once-hold"
            >
              <span aria-hidden="true">👁</span> Mantén presionado para ver
            </button>
          } @else {
            <p class="break-words whitespace-pre-wrap" [class.select-none]="message().view_once">
              @for (part of parts(); track $index) {
                @if (part.href) {
                  <a [href]="part.href" target="_blank" rel="noopener noreferrer nofollow" class="break-all underline underline-offset-2">{{ part.text }}</a>
                } @else {
                  {{ part.text }}
                }
              }
            </p>
          }
        }
        <span class="float-right mt-1 ml-3 flex translate-y-0.5 items-center gap-1 text-[0.68rem]" [class]="mine() ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'">
          @if (message().view_once) {
            <span title="Ver una vez" aria-label="Ver una vez">👁</span>
          }
          @if (deadlineSoon(); as left) {
            <span class="tabular-nums" [attr.aria-label]="'Se autodestruye en ' + left" data-testid="countdown">⏱ {{ left }}</span>
          }
          <time [attr.datetime]="message().created_at">{{ time() }}</time>
          @if (mine() && state(); as current) {
            <app-message-status [state]="current" />
          }
        </span>
      </div>
      @if (message().failed) {
        <div class="mt-1 flex gap-3 text-xs">
          <span class="text-red-600 dark:text-red-400">No se envió.</span>
          <button type="button" class="font-semibold text-cyan-600 hover:underline dark:text-cyan-400" (click)="retry.emit()">Reintentar</button>
          <button type="button" class="text-gray-500 hover:underline" (click)="discard.emit()">Descartar</button>
        </div>
      }
      @if (!message().pending && !message().failed) {
        <button
          type="button"
          class="absolute top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-600 opacity-0 shadow ring-1 ring-gray-900/10 transition group-hover/msg:opacity-100 focus-visible:opacity-100 dark:bg-gray-800 dark:text-gray-300"
          [class]="mine() ? '-left-10' : '-right-10'"
          (click)="reply.emit()"
          aria-label="Responder"
          title="Responder"
          data-testid="reply-button"
        >
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 6 6v5" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
      }
    </div>
  `,
})
export class MessageBubbleComponent {
  public readonly message = input.required<UiMessage>();
  public readonly mine = input(false);
  /** First of a group of consecutive messages from the same sender. */
  public readonly first = input(true);
  /** Last of its group: gets the tail. */
  public readonly last = input(true);
  public readonly showSender = input(false);
  public readonly state = input<DeliveryState | null>(null);
  /** Name to show on quotes of the other person's messages. */
  public readonly partnerName = input('');
  public readonly myId = input(-1);
  public readonly now = input(Date.now());
  public readonly retentionSeconds = input(DEFAULT_RETENTION_SECONDS);
  public readonly retry = output();
  public readonly discard = output();
  public readonly reply = output();
  /** Scroll to a quoted message. */
  public readonly jump = output<number>();

  protected readonly holding = signal(false);
  protected readonly swipe = signal(0);
  private swipeOrigin: { x: number; y: number; id: number } | null = null;

  protected readonly quote = quoteText;
  protected readonly parts = computed(() => linkify(this.message().content));
  protected readonly time = computed(() => timeLabel(this.message().created_at));
  protected readonly senderName = computed(() => displayName(this.message().sender));
  protected readonly quotedName = computed(() => (this.message().reply_to?.sender_id === this.myId() ? 'Tú' : this.partnerName() || 'Mensaje'));
  /** View-once content stays covered for the recipient until held. */
  protected readonly hiddenUntilHeld = computed(() => !!this.message().view_once && !this.mine());
  protected readonly deadlineSoon = computed(() => {
    if (this.message().pending) return null;
    const left = deadlineOf(this.message(), this.retentionSeconds()) - this.now();
    return left <= SHOW_COUNTDOWN_MS ? countdownLabel(left) : null;
  });
  protected readonly bubbleClass = computed(() => {
    const mine = this.mine();
    const base = mine
      ? 'bg-gradient-to-br from-cyan-500 to-indigo-500 text-white'
      : 'bg-white text-gray-900 ring-1 ring-gray-900/5 dark:bg-gray-800 dark:text-gray-100 dark:ring-white/5';
    // Grouped bubbles: tighter inner corners, like a stack.
    const corners = mine
      ? `rounded-l-2xl ${this.first() ? 'rounded-tr-2xl' : 'rounded-tr-md'} ${this.last() ? 'rounded-br-sm' : 'rounded-br-md'}`
      : `rounded-r-2xl ${this.first() ? 'rounded-tl-2xl' : 'rounded-tl-md'} ${this.last() ? 'rounded-bl-sm' : 'rounded-bl-md'}`;
    return `${base} ${corners}`;
  });

  protected hold(event: PointerEvent): void {
    event.preventDefault();
    this.holding.set(true);
  }

  // Swipe right (touch) to reply, like in mobile messengers.
  protected swipeStart(event: PointerEvent): void {
    if (event.pointerType !== 'touch' || this.message().pending) return;
    this.swipeOrigin = { x: event.clientX, y: event.clientY, id: event.pointerId };
  }

  protected swipeMove(event: PointerEvent): void {
    const origin = this.swipeOrigin;
    if (!origin || origin.id !== event.pointerId) return;
    const dx = event.clientX - origin.x;
    if (Math.abs(event.clientY - origin.y) > 30) return this.swipeEnd(false);
    this.swipe.set(Math.max(0, Math.min(dx, SWIPE_TO_REPLY_PX + 16)));
  }

  protected swipeEnd(apply = true): void {
    if (apply && this.swipe() >= SWIPE_TO_REPLY_PX) this.reply.emit();
    this.swipeOrigin = null;
    this.swipe.set(0);
  }
}
