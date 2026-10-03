import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { Subject, type Subscription } from 'rxjs';
import { AuthStore } from '../core/auth/auth.store';
import type { Ack } from '../core/models';
import { RealtimeConnection, type ClientEvents, type ConnectionStatus, type ServerEvent } from '../core/realtime/realtime-connection';
import { DemoServer } from './demo-server';

/** Realtime transport for the demo: events come from the in-browser server. */
@Injectable()
export class DemoConnection extends RealtimeConnection implements OnDestroy {
  private readonly server = inject(DemoServer);
  private readonly auth = inject(AuthStore);

  private readonly state = signal<ConnectionStatus>('idle');
  private readonly subject = new Subject<ServerEvent>();
  private subscription: Subscription | null = null;
  private userId: number | null = null;
  private timer?: ReturnType<typeof setTimeout>;
  private readonly onPageHide = () => this.disconnect();

  public readonly status = this.state.asReadonly();
  public readonly events = this.subject.asObservable();

  public connect(): void {
    if (this.subscription || this.state() === 'connecting') return;
    this.state.set('connecting');
    this.timer = setTimeout(() => {
      const userId = this.server.userIdFromToken(this.auth.token());
      if (userId === null) {
        this.state.set('offline');
        return;
      }
      this.userId = userId;
      this.subscription = this.server.eventsFor(userId).subscribe((event) => this.subject.next(event));
      this.state.set('online');
      this.server.connect(userId);
      window.addEventListener('pagehide', this.onPageHide);
    }, 250 * this.server.speed);
  }

  public disconnect(): void {
    clearTimeout(this.timer);
    window.removeEventListener('pagehide', this.onPageHide);
    this.subscription?.unsubscribe();
    this.subscription = null;
    if (this.userId !== null) this.server.disconnect(this.userId);
    this.userId = null;
    this.state.set('idle');
  }

  public retry(): void {
    this.disconnect();
    this.connect();
  }

  public async emit<K extends keyof ClientEvents>(event: K, payload: ClientEvents[K]): Promise<Ack> {
    if (this.state() !== 'online' || this.userId === null) return { ok: false, error: 'Sin conexión en tiempo real' };
    const userId = this.userId;
    await new Promise((resolve) => setTimeout(resolve, 60 * this.server.speed));
    return this.server.socket(userId, event, payload);
  }

  public ngOnDestroy(): void {
    this.disconnect();
    this.subject.complete();
  }
}
