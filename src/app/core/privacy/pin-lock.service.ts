import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../auth/auth.store';
import { PanicService } from './panic.service';

const SETTINGS_KEY = 'velo.lock';
const FAILS_KEY = 'velo.lock.fails';
export const MAX_PIN_FAILURES = 5;
export const LOCK_CHOICES = [
  { minutes: 1, label: '1 minuto' },
  { minutes: 5, label: '5 minutos' },
  { minutes: 15, label: '15 minutos' },
];

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
};

/**
 * PIN lock: asks for the PIN when the app opens and after a period without
 * activity (or in the background). Too many wrong PINs wipe the device.
 */
@Injectable({ providedIn: 'root' })
export class PinLockService {
  private readonly auth = inject(AuthStore);
  private readonly panic = inject(PanicService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  public readonly enabled = this.auth.pinEnabled;
  /** Locked on start when the device keeps a sealed session. */
  public readonly locked = signal(this.auth.hasPin());
  public readonly failures = signal(Number(read(FAILS_KEY) ?? 0) || 0);
  public readonly minutes = signal(Number(read(SETTINGS_KEY) ?? 5) || 5);
  private lastActivity = Date.now();
  private hiddenAt: number | null = null;

  public constructor() {
    const view = this.document.defaultView;
    if (!view) return;
    const touch = () => (this.lastActivity = Date.now());
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((name) => view.addEventListener(name, touch, { passive: true }));
    const onVisibility = () => {
      if (this.document.visibilityState === 'hidden') this.hiddenAt = Date.now();
      else {
        if (this.hiddenAt !== null && Date.now() - this.hiddenAt >= this.timeoutMs()) this.lock();
        this.hiddenAt = null;
        touch();
      }
    };
    this.document.addEventListener('visibilitychange', onVisibility);
    const timer = setInterval(() => {
      if (Date.now() - this.lastActivity >= this.timeoutMs()) this.lock();
    }, 5000);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      events.forEach((name) => view.removeEventListener(name, touch));
      this.document.removeEventListener('visibilitychange', onVisibility);
    });
  }

  public timeoutMs(): number {
    return this.minutes() * 60_000;
  }

  public setMinutes(minutes: number): void {
    this.minutes.set(minutes);
    write(SETTINGS_KEY, String(minutes));
  }

  /** Locks now (only meaningful with a PIN and an open session). */
  public lock(): void {
    if (this.enabled() && this.auth.isAuthenticated() && !this.locked()) this.locked.set(true);
  }

  /** Returns 'ok', 'wrong' or 'wiped' (too many attempts). */
  public async unlock(pin: string): Promise<'ok' | 'wrong' | 'wiped'> {
    const wasActive = this.auth.isAuthenticated();
    if (await this.auth.unlockWithPin(pin)) {
      this.failures.set(0);
      write(FAILS_KEY, null);
      this.locked.set(false);
      this.lastActivity = Date.now();
      if (!wasActive && this.auth.isAuthenticated()) await this.router.navigateByUrl('/chat');
      return 'ok';
    }
    const failures = this.failures() + 1;
    this.failures.set(failures);
    write(FAILS_KEY, String(failures));
    if (failures >= MAX_PIN_FAILURES) {
      await this.forget();
      return 'wiped';
    }
    return 'wrong';
  }

  public async enable(pin: string): Promise<void> {
    await this.auth.enablePin(pin);
    this.failures.set(0);
    write(FAILS_KEY, null);
    this.lastActivity = Date.now();
  }

  public async disable(pin: string): Promise<boolean> {
    return this.auth.disablePin(pin);
  }

  /** "Forgot my PIN" or too many attempts: wipe and sign in again. */
  public async forget(): Promise<void> {
    write(FAILS_KEY, null);
    await this.panic.wipe();
  }
}
