import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { Conversation } from '../../core/models';
import { dayLabel, isSameDay } from '../../shared/time';
import { ChatStore, type Thread, type UiMessage } from './chat.store';
import { MessageBubbleComponent } from './message-bubble.component';

interface Row {
  key: string;
  day?: string;
  message: UiMessage;
  first: boolean;
}

const GROUP_GAP_MS = 5 * 60_000;
const NEAR_BOTTOM_PX = 120;

/**
 * Scrollable history: day separators, grouping of consecutive messages,
 * infinite scroll upwards (keeping the scroll position) and auto-scroll to
 * the newest message only when the user is already at the bottom.
 */
@Component({
  selector: 'app-message-list',
  imports: [MessageBubbleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative flex min-h-0 flex-1 flex-col' },
  template: `
    <div
      #scroller
      class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 sm:px-6"
      (scroll)="onScroll()"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label="Mensajes"
      data-testid="message-list"
    >
      <div #top class="h-px"></div>
      @if (thread().loading && thread().messages.length) {
        <p class="py-3 text-center text-xs text-gray-500">Cargando mensajes anteriores…</p>
      }
      @if (!thread().hasMore && thread().loaded && thread().messages.length) {
        <p class="py-4 text-center text-xs text-gray-400">🔒 Este es el inicio de la conversación</p>
      }
      @if (thread().error) {
        <p class="py-3 text-center text-sm text-red-600 dark:text-red-400" role="alert">{{ thread().error }}</p>
      }
      @if (thread().loaded && !thread().messages.length) {
        <div class="flex h-full flex-col items-center justify-center gap-2 py-16 text-center text-gray-500 dark:text-gray-400">
          <span class="text-4xl" aria-hidden="true">👋</span>
          <p class="text-sm">Todavía no hay mensajes. ¡Saluda!</p>
        </div>
      }
      @if (!thread().loaded && thread().loading) {
        <div class="flex flex-col gap-3 py-6" aria-hidden="true">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="h-10 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" [class]="i % 2 ? 'mr-auto w-2/3' : 'ml-auto w-1/2'"></div>
          }
        </div>
      }
      @for (row of rows(); track row.key) {
        @if (row.day) {
          <div class="sticky top-1 z-10 my-3 flex justify-center">
            <span class="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-600 shadow-sm ring-1 ring-gray-900/5 backdrop-blur dark:bg-gray-800/90 dark:text-gray-300">
              {{ row.day }}
            </span>
          </div>
        }
        <app-message-bubble
          [message]="row.message"
          [mine]="row.message.sender_id === meId()"
          [first]="row.first"
          [showSender]="conversation().type !== 'direct'"
          [state]="row.message.sender_id === meId() ? store.deliveryState(conversation(), row.message) : null"
          (retry)="store.retry(row.message)"
          (discard)="store.discard(row.message)"
        />
      }
    </div>
    @if (!atBottom()) {
      <button
        type="button"
        class="absolute right-4 bottom-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-700 shadow-lg ring-1 ring-gray-900/10 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200"
        (click)="scrollToBottom(true)"
        aria-label="Ir a los mensajes más recientes"
      >
        ↓
        @if (unseen()) {
          <span class="absolute -top-1 -right-1 rounded-full bg-indigo-600 px-1.5 text-[0.65rem] font-bold text-white">{{ unseen() }}</span>
        }
      </button>
    }
  `,
})
export class MessageListComponent implements OnDestroy {
  protected readonly store = inject(ChatStore);
  public readonly conversation = input.required<Conversation>();
  public readonly thread = input.required<Thread>();
  public readonly loadOlder = output();

  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private readonly top = viewChild.required<ElementRef<HTMLElement>>('top');
  protected readonly atBottom = signal(true);
  protected readonly unseen = signal(0);
  protected readonly meId = computed(() => this.store.me()?.id ?? -1);

  private observer?: IntersectionObserver;
  private lastConversationId: number | null = null;
  private lastNewestKey: string | null = null;
  private lastFirstKey: string | null = null;
  private heightBeforePrepend = 0;

  protected readonly rows = computed<Row[]>(() => {
    const messages = this.thread().messages;
    return messages.map((message, index) => {
      const previous = messages[index - 1];
      const newDay = !previous || !isSameDay(previous.created_at, message.created_at);
      const grouped =
        !!previous &&
        !newDay &&
        previous.sender_id === message.sender_id &&
        new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() < GROUP_GAP_MS;
      return { key: message.key, day: newDay ? dayLabel(message.created_at) : undefined, message, first: !grouped };
    });
  });

  public constructor() {
    afterRenderEffect(() => {
      const conversationId = this.conversation().id;
      const messages = this.thread().messages;
      untracked(() => this.afterMessagesRendered(conversationId, messages));
    });
    afterRenderEffect(() => {
      this.top();
      untracked(() => this.observeTop());
    });
  }

  public ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  protected onScroll(): void {
    const element = this.scroller().nativeElement;
    const near = element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM_PX;
    this.atBottom.set(near);
    if (near) {
      this.unseen.set(0);
      this.store.markActiveRead();
    }
  }

  public scrollToBottom(smooth = false): void {
    const element = this.scroller().nativeElement;
    element.scrollTo({ top: element.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    this.atBottom.set(true);
    this.unseen.set(0);
  }

  private afterMessagesRendered(conversationId: number, messages: UiMessage[]): void {
    const element = this.scroller().nativeElement;
    const newest = messages.at(-1);
    const first = messages[0];

    if (conversationId !== this.lastConversationId) {
      // Opened another chat: start at the bottom.
      this.lastConversationId = conversationId;
      this.scrollToBottom();
    } else if (first && this.lastFirstKey && first.key !== this.lastFirstKey && newest?.key === this.lastNewestKey) {
      // Older messages were prepended: keep what the user was looking at.
      element.scrollTop += element.scrollHeight - this.heightBeforePrepend;
    } else if (newest && newest.key !== this.lastNewestKey) {
      const mine = newest.sender_id === this.meId();
      if (mine || this.atBottom()) this.scrollToBottom(true);
      else this.unseen.update((count) => count + 1);
    }
    this.lastNewestKey = newest?.key ?? null;
    this.lastFirstKey = first?.key ?? null;
    this.heightBeforePrepend = element.scrollHeight;
  }

  private observeTop(): void {
    this.observer?.disconnect();
    if (typeof IntersectionObserver === 'undefined') return;
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && this.thread().hasMore && !this.thread().loading) {
          this.heightBeforePrepend = this.scroller().nativeElement.scrollHeight;
          this.loadOlder.emit();
        }
      },
      { root: this.scroller().nativeElement, rootMargin: '200px 0px 0px 0px' },
    );
    this.observer.observe(this.top().nativeElement);
  }
}
