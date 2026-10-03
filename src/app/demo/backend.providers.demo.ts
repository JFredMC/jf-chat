import { HttpBackend } from '@angular/common/http';
import { inject, type Provider } from '@angular/core';
import { DEMO_CONTROLS } from '../core/config';
import { RealtimeConnection } from '../core/realtime/realtime-connection';
import { DemoConnection } from './demo-connection';
import { DemoHttpBackend } from './demo-http-backend';
import { DemoServer } from './demo-server';

/** Demo build: the API and the realtime events run inside the browser. */
export const backendProviders: Provider[] = [
  { provide: HttpBackend, useClass: DemoHttpBackend },
  { provide: RealtimeConnection, useClass: DemoConnection },
  {
    provide: DEMO_CONTROLS,
    useFactory: () => {
      const server = inject(DemoServer);
      return { reset: () => server.reset() };
    },
  },
];
