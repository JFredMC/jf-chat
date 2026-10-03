import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthStore } from './core/auth/auth.store';
import { RealtimeConnection } from './core/realtime/realtime-connection';
import { SocketIoConnection } from './core/realtime/socket-io-connection';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling()),
    // XHR backend (not fetch) so uploads report progress.
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: RealtimeConnection, useClass: SocketIoConnection },
    // Resume the session (refresh token) before the first navigation.
    provideAppInitializer(() => inject(AuthStore).restore()),
  ],
};
