import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { io, type Socket } from 'socket.io-client';
import { AuthStore, isSessionRejected } from '../auth/auth.store';
import { API_URL } from '../config';
import type { Ack } from '../models';
import { RealtimeConnection, type ClientEvents, type ConnectionStatus, type ServerEvent, type ServerEvents } from './realtime-connection';

const ACK_TIMEOUT_MS = 8000;
/** Consecutive "token rejected" disconnects before giving up (avoids loops). */
const MAX_RENEWALS = 3;

const SERVER_EVENTS: (keyof ServerEvents)[] = [
  'new_message',
  'typing',
  'conversation_read',
  'conversation_delivered',
  'conversation_updated',
  'presence_snapshot',
  'presence',
  'friendship_updated',
  'user_updated',
  'session_expired',
];

/**
 * Socket.IO connection to the `/chat` namespace.
 *
 * The server authenticates with the access token in the handshake and closes
 * the socket (after `session_expired`) when the token is invalid or expires.
 * Then the token is renewed with the refresh token and the socket reconnects;
 * network drops are retried by Socket.IO itself.
 */
@Injectable()
export class SocketIoConnection extends RealtimeConnection implements OnDestroy {
  private readonly auth = inject(AuthStore);
  private readonly api = inject(API_URL);

  private socket: Socket | null = null;
  private renewals = 0;
  private renewTimer?: ReturnType<typeof setTimeout>;
  private readonly state = signal<ConnectionStatus>('idle');
  private readonly subject = new Subject<ServerEvent>();

  public readonly status = this.state.asReadonly();
  public readonly events = this.subject.asObservable();

  public connect(): void {
    if (this.socket) return;
    this.state.set('connecting');
    const socket = io(`${this.api}/chat`, {
      auth: (cb) => cb({ token: this.auth.token() ?? '' }),
      transports: ['websocket'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
    });
    this.socket = socket;

    for (const event of SERVER_EVENTS) {
      socket.on(event, (data: unknown) => {
        // The snapshot only arrives after a successful authentication.
        if (event === 'presence_snapshot') {
          this.renewals = 0;
          this.state.set('online');
        }
        this.subject.next({ type: event, data } as ServerEvent);
      });
    }
    socket.on('disconnect', (reason) => {
      if (this.socket !== socket || reason === 'io client disconnect') return;
      this.state.set('reconnecting');
      // The server closed the socket: the token was rejected or expired.
      if (reason === 'io server disconnect') this.renewAndReconnect();
    });
    socket.on('connect_error', () => {
      if (this.state() !== 'offline') this.state.set(this.state() === 'connecting' ? 'connecting' : 'reconnecting');
    });
    socket.io.on('reconnect_attempt', () => {
      if (this.state() === 'online') this.state.set('reconnecting');
    });
  }

  public disconnect(): void {
    clearTimeout(this.renewTimer);
    const socket = this.socket;
    this.socket = null;
    this.renewals = 0;
    socket?.removeAllListeners();
    socket?.io.removeAllListeners();
    socket?.disconnect();
    this.state.set('idle');
  }

  public retry(): void {
    if (!this.socket) return this.connect();
    this.renewals = 0;
    this.state.set('reconnecting');
    this.renewAndReconnect();
  }

  public emit<K extends keyof ClientEvents>(event: K, payload: ClientEvents[K]): Promise<Ack> {
    const socket = this.socket;
    if (!socket?.connected || this.state() !== 'online') return Promise.resolve({ ok: false, error: 'Sin conexión en tiempo real' });
    return socket
      .timeout(ACK_TIMEOUT_MS)
      .emitWithAck(event, payload)
      .then((ack: Ack) => ack ?? { ok: true })
      .catch(() => ({ ok: false, error: 'El servidor no respondió' }));
  }

  public ngOnDestroy(): void {
    this.disconnect();
    this.subject.complete();
  }

  private renewAndReconnect(): void {
    clearTimeout(this.renewTimer);
    if (++this.renewals > MAX_RENEWALS) {
      this.state.set('offline');
      return;
    }
    this.auth.refresh().subscribe({
      next: () => this.socket?.connect(),
      error: (error: unknown) => {
        if (isSessionRejected(error)) {
          this.auth.expire();
          return;
        }
        // Network problem while renewing: try again a bit later.
        this.renewTimer = setTimeout(() => this.renewAndReconnect(), 2000 * this.renewals);
      },
    });
  }
}
