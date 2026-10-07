import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';

/** A curated set: enough for two people talking, light enough to ship inline. */
export const EMOJI_GROUPS: { id: string; label: string; icon: string; emojis: string[] }[] = [
  {
    id: 'caras',
    label: 'Caras',
    icon: '😊',
    emojis: [
      '😊', '😂', '🤣', '😍', '🥰', '😘', '😚', '😋', '😏', '😌', '😉', '🙈', '🤭', '🤫', '🤔', '😳',
      '🥺', '😢', '😭', '😤', '😴', '🤤', '😇', '🥵', '🫠', '😎', '🤗', '🙃', '😅', '😬', '🫣', '😈',
    ],
  },
  {
    id: 'amor',
    label: 'Amor',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '❤️‍🔥',
      '💋', '💌', '🌹', '🥀', '💐', '💍', '🫶', '🤞', '😽', '👄', '🔥', '✨', '🌙', '⭐', '🌟', '💫',
    ],
  },
  {
    id: 'gestos',
    label: 'Gestos',
    icon: '👋',
    emojis: ['👋', '👍', '👎', '👌', '🤌', '✌️', '🤙', '👏', '🙌', '🙏', '💪', '🤝', '👀', '🫦', '🤷', '🙆', '🙅', '💃', '🕺', '🫂'],
  },
  {
    id: 'planes',
    label: 'Planes',
    icon: '🍷',
    emojis: ['☕', '🍷', '🥂', '🍾', '🍕', '🍣', '🍫', '🍓', '🍒', '🍑', '🎬', '🎶', '🎧', '🛏️', '🛁', '🚗', '✈️', '🏖️', '🌃', '🌧️', '🔒', '🤐', '⏳', '📍'],
  },
];

/** Emoji picker for the composer. Recent picks live in memory only. */
@Component({
  selector: 'app-emoji-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl bg-white p-2 shadow-2xl ring-1 ring-gray-900/10 dark:bg-gray-900 dark:ring-white/10" role="dialog" aria-label="Emojis" data-testid="emoji-picker">
      <div class="flex gap-1 border-b border-gray-200 pb-2 dark:border-gray-800" role="tablist" aria-label="Categorías de emojis">
        @if (recent().length) {
          <button type="button" role="tab" class="btn-icon h-9 w-9 text-lg" [class.bg-gray-100]="group() === 'recientes'" [class.dark:bg-gray-800]="group() === 'recientes'"
            [attr.aria-selected]="group() === 'recientes'" (click)="group.set('recientes')" aria-label="Recientes" title="Recientes">🕘</button>
        }
        @for (g of groups; track g.id) {
          <button type="button" role="tab" class="btn-icon h-9 w-9 text-lg" [class.bg-gray-100]="group() === g.id" [class.dark:bg-gray-800]="group() === g.id"
            [attr.aria-selected]="group() === g.id" (click)="group.set(g.id)" [attr.aria-label]="g.label" [title]="g.label">{{ g.icon }}</button>
        }
      </div>
      <div class="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto pt-2" role="tabpanel">
        @for (emoji of visible(); track emoji) {
          <button type="button" class="flex h-9 w-9 items-center justify-center rounded-lg text-xl transition hover:bg-gray-100 active:scale-90 dark:hover:bg-gray-800"
            (click)="choose(emoji)" [attr.aria-label]="emoji" data-testid="emoji">{{ emoji }}</button>
        }
      </div>
    </div>
  `,
})
export class EmojiPickerComponent {
  private static recentPicks = signal<string[]>([]);
  public readonly picked = output<string>();
  protected readonly groups = EMOJI_GROUPS;
  protected readonly recent = EmojiPickerComponent.recentPicks.asReadonly();
  protected readonly group = signal(EmojiPickerComponent.recentPicks().length ? 'recientes' : 'caras');

  protected visible(): string[] {
    if (this.group() === 'recientes') return this.recent();
    return this.groups.find((g) => g.id === this.group())?.emojis ?? [];
  }

  protected choose(emoji: string): void {
    EmojiPickerComponent.recentPicks.update((list) => [emoji, ...list.filter((e) => e !== emoji)].slice(0, 16));
    this.picked.emit(emoji);
  }
}
