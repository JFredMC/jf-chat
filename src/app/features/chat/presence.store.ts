import { Injectable, OnDestroy, computed, signal } from '@angular/core';
import type { PresenceUpdate, TypingEvent, User } from '../../core/models';
import { lastSeenLabel } from '../../shared/time';

interface PresenceEntry {
  online: boolean;
  lastSeen: string | null;
}

/** A typing indicator disappears on its own if "stopped typing" never arrives. */
export const TYPING_TTL_MS = 6000;

/** Who is online and who is typing where (fed by the realtime connection). */
@Injectable({ providedIn: 'root' })
export class PresenceStore implements OnDestroy {
  private readonly presence = signal<Record<number, PresenceEntry>>({});
  /** conversationId -> userId -> expiry timestamp */
  private readonly typing = signal<Record<number, Record<number, number>>>({});
  private readonly now = signal(Date.now());
  private readonly clock = setInterval(() => this.tick(), 1000);

  /** Refreshes "visto hace X minutos" labels every 30 s. */
  private readonly minute = signal(0);
  private minuteCounter = 0;

  public readonly onlineIds = computed(() =>
    Object.entries(this.presence())
      .filter(([, entry]) => entry.online)
      .map(([id]) => Number(id)),
  );

  public ngOnDestroy(): void {
    clearInterval(this.clock);
  }

  public isOnline(userId: number | undefined): boolean | null {
    if (userId === undefined) return null;
    return this.presence()[userId]?.online ?? false;
  }

  public label(userId: number | undefined, fallbackLastSeen?: string | null, hidden = false): string {
    this.minute();
    if (userId === undefined) return '';
    const entry = this.presence()[userId];
    if (entry?.online) return 'en línea';
    // They chose to hide it: say so instead of a misleading "desconectado".
    if (hidden) return 'última conexión oculta';
    return lastSeenLabel(entry?.lastSeen ?? fallbackLastSeen);
  }

  /** Seeds presence from REST data (status/last_seen on users). */
  public seed(users: (User | undefined)[]): void {
    this.presence.update((current) => {
      const next = { ...current };
      for (const user of users) {
        if (!user || next[user.id]) continue;
        next[user.id] = { online: user.status === 'online', lastSeen: user.last_seen ?? null };
      }
      return next;
    });
  }

  public apply(updates: PresenceUpdate[]): void {
    this.presence.update((current) => {
      const next = { ...current };
      for (const update of updates) next[update.userId] = { online: update.online, lastSeen: update.lastSeen ?? next[update.userId]?.lastSeen ?? null };
      return next;
    });
    for (const update of updates) if (!update.online) this.clearTypingOf(update.userId);
  }

  public setTyping(event: TypingEvent): void {
    this.typing.update((current) => {
      const users = { ...(current[event.conversationId] ?? {}) };
      if (event.isTyping) users[event.userId] = Date.now() + TYPING_TTL_MS;
      else delete users[event.userId];
      return { ...current, [event.conversationId]: users };
    });
  }

  /** A message from someone means they stopped typing. */
  public clearTyping(conversationId: number, userId: number): void {
    this.setTyping({ conversationId, userId, username: '', isTyping: false });
  }

  public typingIn(conversationId: number): number[] {
    const now = this.now();
    return Object.entries(this.typing()[conversationId] ?? {})
      .filter(([, expiry]) => expiry > now)
      .map(([id]) => Number(id));
  }

  public reset(): void {
    this.presence.set({});
    this.typing.set({});
  }

  private clearTypingOf(userId: number): void {
    this.typing.update((current) => {
      const next: Record<number, Record<number, number>> = {};
      for (const [conversationId, users] of Object.entries(current)) {
        const copy = { ...users };
        delete copy[userId];
        next[Number(conversationId)] = copy;
      }
      return next;
    });
  }

  private tick(): void {
    // Only re-render when a typing indicator could have expired.
    const hasTyping = Object.values(this.typing()).some((users) => Object.keys(users).length);
    if (hasTyping) this.now.set(Date.now());
    if (++this.minuteCounter >= 30) {
      this.minuteCounter = 0;
      this.minute.update((value) => value + 1);
    }
  }
}
