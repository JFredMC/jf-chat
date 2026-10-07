import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { TitleStrategy, provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { backendProviders } from './backend.providers';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthStore } from './core/auth/auth.store';
import { BrandTitleStrategy } from './core/ui/brand-title.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling()),
    { provide: TitleStrategy, useClass: BrandTitleStrategy },
    // XHR backend (not fetch) so uploads report progress.
    provideHttpClient(withInterceptors([authInterceptor])),
    // Real API + Socket.IO, or the in-browser backend in the demo build.
    ...backendProviders,
    // Resume the session (refresh token) before the first navigation.
    provideAppInitializer(() => inject(AuthStore).restore()),
  ],
};
