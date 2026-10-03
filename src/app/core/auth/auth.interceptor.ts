import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { API_URL } from '../config';
import { AuthStore, isSessionRejected } from './auth.store';

/** Credential endpoints: a 401 there means "wrong data", not "token expired". */
const PUBLIC_AUTH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout', '/auth/username-available'];

const withToken = (req: HttpRequest<unknown>, token: string | null) =>
  token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

/**
 * Adds the access token to API calls. On a 401 it refreshes the token once
 * (shared by concurrent requests) and retries; if that fails the session ends.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthStore);
  const api = inject(API_URL);
  if (!req.url.startsWith(api)) return next(req);

  const path = req.url.slice(api.length).split('?')[0];
  if (PUBLIC_AUTH.includes(path)) return next(req);

  return next(withToken(req, auth.token())).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }
      return auth.refresh().pipe(
        catchError((refreshError: unknown) => {
          if (isSessionRejected(refreshError)) auth.expire();
          return throwError(() => refreshError);
        }),
        switchMap((token) => next(withToken(req, token))),
      );
    }),
  );
};
