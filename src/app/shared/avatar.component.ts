import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { API_URL } from '../core/config';
import { avatarSrc, displayName, type User } from '../core/models';

const COLORS = [
  'from-rose-500 to-pink-500',
  'from-orange-500 to-amber-500',
  'from-emerald-500 to-teal-500',
  'from-sky-500 to-blue-600',
  'from-indigo-500 to-violet-600',
  'from-fuchsia-500 to-purple-600',
  'from-cyan-500 to-sky-600',
  'from-lime-500 to-green-600',
];

/** Profile photo, or initials with a stable color per user, and an optional presence dot. */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="relative inline-flex shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white"
      [class]="color()"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [style.font-size.px]="size() * 0.38"
      aria-hidden="true"
    >
      @if (src(); as url) {
        <img
          [src]="url"
          alt=""
          class="h-full w-full rounded-full bg-gray-200 object-cover dark:bg-gray-800"
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
          (error)="failed.set(url)"
          data-testid="avatar-img"
        />
      } @else {
        {{ initials() }}
      }
      @if (online() !== null) {
        <span
          class="absolute right-0 bottom-0 block rounded-full ring-2 ring-white dark:ring-gray-900"
          [class]="online() ? 'bg-emerald-500' : 'bg-gray-400'"
          [style.width.px]="size() * 0.28"
          [style.height.px]="size() * 0.28"
          data-testid="presence-dot"
        ></span>
      }
    </span>
  `,
})
export class AvatarComponent {
  private readonly api = inject(API_URL);
  public readonly user = input.required<Pick<User, 'id' | 'username'> & Partial<Pick<User, 'avatar_url'>> | null | undefined>();
  public readonly size = input(40);
  /** null hides the dot. */
  public readonly online = input<boolean | null>(null);
  /** An image that failed to load falls back to the initials. */
  protected readonly failed = signal<string | null>(null);

  protected readonly src = computed(() => {
    const url = avatarSrc(this.user()?.avatar_url, this.api);
    return url && url !== this.failed() ? url : null;
  });

  protected readonly initials = computed(() => {
    const user = this.user();
    if (!user) return '?';
    const name = displayName(user);
    const parts = name.split(/\s+/).filter(Boolean);
    const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
    return letters.toUpperCase();
  });

  protected readonly color = computed(() => {
    const id = this.user()?.id ?? 0;
    return COLORS[Math.abs(id) % COLORS.length];
  });
}
