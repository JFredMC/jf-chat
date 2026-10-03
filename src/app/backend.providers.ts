import type { Provider } from '@angular/core';
import { RealtimeConnection } from './core/realtime/realtime-connection';
import { SocketIoConnection } from './core/realtime/socket-io-connection';

/**
 * Real backend: HTTP to jf-chat-be and Socket.IO for realtime.
 * The `demo` build replaces this file with `demo/backend.providers.demo.ts`.
 */
export const backendProviders: Provider[] = [{ provide: RealtimeConnection, useClass: SocketIoConnection }];
