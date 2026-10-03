import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { authGuard } from './auth.guard';
import { guestGuard } from './guest.guard';

describe('route guards', () => {
  const run = (guard: typeof authGuard) =>
    TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('sends visitors to /auth/login instead of a missing /login route', () => {
    const result = run(authGuard);
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/auth/login');
    expect(run(guestGuard)).toBe(true);
  });

  it('lets signed-in users into the chat and keeps them out of login', () => {
    TestBed.inject(AuthService).currentUser.set({ id: 1, username: 'ana' } as never);
    expect(run(authGuard)).toBe(true);
    const result = run(guestGuard);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/chat');
  });
});
