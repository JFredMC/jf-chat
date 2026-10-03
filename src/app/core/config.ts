import { InjectionToken } from '@angular/core';
import { environment } from '../../environments/environment';

/** Base URL of the API, without a trailing slash. */
export const API_URL = new InjectionToken<string>('API_URL', {
  factory: () => environment.apiUrl.replace(/\/$/, ''),
});

export const IS_DEMO = new InjectionToken<boolean>('IS_DEMO', {
  factory: () => environment.demo,
});
