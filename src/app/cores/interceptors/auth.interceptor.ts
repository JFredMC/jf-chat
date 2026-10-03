import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../../services/auth.service';

/** Endpoints whose 401 means "wrong credentials", not "session expired". */
const AUTH_ENDPOINTS = ['/auth/login', '/auth/logout', '/auth/refresh'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      const isAuthEndpoint = AUTH_ENDPOINTS.some((path) => req.url.includes(path));
      // Clearing the session locally (instead of calling POST /auth/logout,
      // which would 401 again) avoids an endless logout loop.
      if (error.status === 401 && !isAuthEndpoint) {
        authService.endSession();
      }
      return throwError(() => error);
    }),
  );
};
