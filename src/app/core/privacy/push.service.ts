import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL, IS_DEMO } from '../config';

export type PushState = 'unsupported' | 'unavailable' | 'denied' | 'off' | 'on' | 'busy';

/** Service worker that shows the notification (only a random code). */
export const PUSH_WORKER = 'push-sw.js';

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Content-free Web Push. The server only pushes after a long silence and the
 * payload is a random PIN: the notification never says who wrote or what.
 */
@Injectable({ providedIn: 'root' })
export class PushNotificationsService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly demo = inject(IS_DEMO);
  public readonly state = signal<PushState>('off');

  public supported(): boolean {
    return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  /** Reads the current state (permission + existing subscription). */
  public async refresh(): Promise<void> {
    if (this.demo) return this.state.set('unavailable');
    if (!this.supported()) return this.state.set('unsupported');
    if (Notification.permission === 'denied') return this.state.set('denied');
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    this.state.set(subscription ? 'on' : 'off');
  }

  public async enable(): Promise<PushState> {
    if (!this.supported()) return this.finish('unsupported');
    this.state.set('busy');
    try {
      const { publicKey } = await firstValueFrom(this.http.get<{ publicKey: string | null }>(`${this.api}/push/public-key`));
      if (!publicKey) return this.finish('unavailable');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return this.finish(permission === 'denied' ? 'denied' : 'off');
      const registration = await navigator.serviceWorker.register(PUSH_WORKER, { scope: './' });
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) }));
      const json = subscription.toJSON();
      await firstValueFrom(this.http.post(`${this.api}/push/subscription`, { endpoint: json.endpoint, keys: json.keys }));
      return this.finish('on');
    } catch {
      return this.finish('off');
    }
  }

  public async disable(): Promise<void> {
    if (!this.supported()) return;
    this.state.set('busy');
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await firstValueFrom(this.http.delete(`${this.api}/push/subscription`, { body: { endpoint } })).catch(() => undefined);
      }
    } finally {
      this.state.set('off');
    }
  }

  private finish(state: PushState): PushState {
    this.state.set(state);
    return state;
  }
}
