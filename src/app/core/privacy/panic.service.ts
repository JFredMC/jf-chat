import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { AuthStore } from '../auth/auth.store';
import { PushNotificationsService } from './push.service';

/** Preferences that are not personal and keep the app discreet after a wipe. */
const KEEP = new Set(['velo.disguise', 'velo.theme']);

/**
 * Panic: closes the session on the server, drops the push subscription and
 * wipes everything Velo keeps on this device, then reloads on the login page
 * (nothing stays in memory either).
 */
@Injectable({ providedIn: 'root' })
export class PanicService {
  private readonly auth = inject(AuthStore);
  private readonly push = inject(PushNotificationsService);
  private readonly document = inject(DOCUMENT);

  public async wipe(): Promise<void> {
    // Best effort, but never wait long: speed matters more here.
    await Promise.race([this.push.disable().catch(() => undefined), new Promise((resolve) => setTimeout(resolve, 800))]);
    this.auth.logout();
    wipeLocalData();
    await Promise.race([clearWorkers(), new Promise((resolve) => setTimeout(resolve, 800))]);
    const base = this.document.querySelector('base')?.getAttribute('href') ?? '/';
    this.document.defaultView?.location.replace(`${base}auth/login`);
  }
}

export function wipeLocalData(storage: Storage = localStorage, session: Storage = sessionStorage): void {
  try {
    for (const key of Object.keys(storage)) if (!KEEP.has(key)) storage.removeItem(key);
    session.clear();
  } catch {
    /* storage disabled */
  }
}

async function clearWorkers(): Promise<void> {
  try {
    if ('caches' in globalThis) for (const key of await caches.keys()) await caches.delete(key);
    if ('serviceWorker' in navigator) for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister();
  } catch {
    /* ignore */
  }
}
