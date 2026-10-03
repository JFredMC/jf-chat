import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { API } from '../../testing/fixtures';
import { API_URL } from '../config';
import { AuthStore } from './auth.store';
import { authGuard, guestGuard } from './guards';

describe('route guards', () => {
  const run = (guard: typeof authGuard) =>
    TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: API_URL, useValue: API }],
    });
  });

  it('sends visitors to the login page', () => {
    const result = run(authGuard);
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/auth/login');
    expect(run(guestGuard)).toBe(true);
  });

  it('sends signed-in users to the chat', () => {
    const auth = TestBed.inject(AuthStore);
    vi.spyOn(auth, 'isAuthenticated').mockReturnValue(true);
    expect(run(authGuard)).toBe(true);
    expect(TestBed.inject(Router).serializeUrl(run(guestGuard) as UrlTree)).toBe('/chat');
  });
});
