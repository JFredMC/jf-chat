import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { displayName } from '../../core/models';
import { timeLabel } from '../../shared/time';
import { AttachmentViewComponent } from './attachment-view.component';
import type { DeliveryState, UiMessage } from './chat.store';
import { linkify } from './linkify';
import { MessageStatusComponent } from './message-status.component';

@Component({
  selector: 'app-message-bubble',
  imports: [MessageStatusComponent, AttachmentViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex w-full', '[class.justify-end]': 'mine()', '[class.mt-3]': 'first()', '[class.mt-0.5]': '!first()' },
  template: `
    <div class="flex max-w-[85%] flex-col sm:max-w-[70%]" [class.items-end]="mine()" [class.items-start]="!mine()">
      @if (showSender() && first() && !mine()) {
        <span class="mb-0.5 px-3 text-xs font-medium text-indigo-600 dark:text-indigo-400">{{ senderName() }}</span>
      }
      <div
        class="relative rounded-2xl px-3 py-2 text-[0.94rem] leading-snug shadow-sm"
        [class]="
          mine()
            ? 'bg-gradient-to-br from-cyan-500 to-indigo-500 text-white ' + (first() ? 'rounded-tr-md' : '')
            : 'bg-white text-gray-900 ring-1 ring-gray-900/5 dark:bg-gray-800 dark:text-gray-100 dark:ring-white/5 ' + (first() ? 'rounded-tl-md' : '')
        "
        [class.opacity-70]="message().pending"
        [attr.data-testid]="'message'"
        [attr.data-mine]="mine()"
      >
        @if (message().attachments?.length) {
          <div class="mb-1 flex flex-col gap-1.5">
            @for (attachment of message().attachments; track attachment.id) {
              <app-attachment-view [attachment]="attachment" />
            }
          </div>
        }
        @if (message().content) {
          <p class="break-words whitespace-pre-wrap">
            @for (part of parts(); track $index) {
              @if (part.href) {
                <a [href]="part.href" target="_blank" rel="noopener noreferrer nofollow" class="underline underline-offset-2 break-all">{{ part.text }}</a>
              } @else {
                {{ part.text }}
              }
            }
          </p>
        }
        <span class="mt-0.5 flex items-center justify-end gap-1 text-[0.68rem]" [class]="mine() ? 'text-white/75' : 'text-gray-500 dark:text-gray-400'">
          <time [attr.datetime]="message().created_at">{{ time() }}</time>
          @if (mine() && state(); as current) {
            <app-message-status [state]="current" />
          }
        </span>
      </div>
      @if (message().failed) {
        <div class="mt-1 flex gap-3 text-xs">
          <span class="text-red-600 dark:text-red-400">No se envió.</span>
          <button type="button" class="font-semibold text-indigo-600 hover:underline dark:text-indigo-400" (click)="retry.emit()">Reintentar</button>
          <button type="button" class="text-gray-500 hover:underline" (click)="discard.emit()">Descartar</button>
        </div>
      }
    </div>
  `,
})
export class MessageBubbleComponent {
  public readonly message = input.required<UiMessage>();
  public readonly mine = input(false);
  /** First of a group of consecutive messages from the same sender. */
  public readonly first = input(true);
  public readonly showSender = input(false);
  public readonly state = input<DeliveryState | null>(null);
  public readonly retry = output();
  public readonly discard = output();

  protected readonly parts = computed(() => linkify(this.message().content));
  protected readonly time = computed(() => timeLabel(this.message().created_at));
  protected readonly senderName = computed(() => displayName(this.message().sender));
}
