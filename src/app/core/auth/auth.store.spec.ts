import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API, session, user } from '../../testing/fixtures';
import { API_URL } from '../config';
import { authInterceptor } from './auth.interceptor';
import { AuthStore } from './auth.store';

describe('AuthStore + authInterceptor', () => {
  let http: HttpTestingController;
  let store: AuthStore;
  let client: HttpClient;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: API },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
    client = TestBed.inject(HttpClient);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => http.verify());

  const login = async () => {
    const result = firstValueFrom(store.login('ana', 'Secreta123'));
    http.expectOne(`${API}/auth/login`).flush(session());
    await result;
  };

  it('keeps the access token in memory and only the refresh token in storage', async () => {
    await login();
    expect(store.user()?.username).toBe('ana');
    expect(store.token()).toBe('access-1');
    expect(localStorage.getItem('velo.session')).toBe('refresh-1');
    expect(JSON.stringify(localStorage)).not.toContain('access-1');
  });

  it('does not attach the token to credential endpoints or other hosts', async () => {
    await login();
    client.get('https://example.com/x').subscribe();
    expect(http.expectOne('https://example.com/x').request.headers.has('Authorization')).toBe(false);
    client.get(`${API}/auth/username-available`).subscribe();
    expect(http.expectOne(`${API}/auth/username-available`).request.headers.has('Authorization')).toBe(false);
    client.get(`${API}/conversation`).subscribe();
    expect(http.expectOne(`${API}/conversation`).request.headers.get('Authorization')).toBe('Bearer access-1');
  });

  it('refreshes once for concurrent 401s and retries every request with the new token', async () => {
    await login();
    const a = firstValueFrom(client.get<string>(`${API}/a`));
    const b = firstValueFrom(client.get<string>(`${API}/b`));
    http.expectOne(`${API}/a`).flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(`${API}/b`).flush(null, { status: 401, statusText: 'Unauthorized' });

    const refresh = http.expectOne(`${API}/auth/refresh`);
    expect(refresh.request.body).toEqual({ refreshToken: 'refresh-1' });
    refresh.flush(session(user(1, 'ana'), 2));

    const retryA = http.expectOne(`${API}/a`);
    const retryB = http.expectOne(`${API}/b`);
    expect(retryA.request.headers.get('Authorization')).toBe('Bearer access-2');
    retryA.flush('A');
    retryB.flush('B');
    expect(await Promise.all([a, b])).toEqual(['A', 'B']);
    expect(localStorage.getItem('velo.session')).toBe('refresh-2');
  });

  it('ends the session and redirects when the refresh token is rejected', async () => {
    await login();
    const request = firstValueFrom(client.get(`${API}/a`));
    http.expectOne(`${API}/a`).flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(`${API}/auth/refresh`).flush(null, { status: 401, statusText: 'Unauthorized' });
    await expect(request).rejects.toBeTruthy();
    expect(store.user()).toBeNull();
    expect(localStorage.getItem('velo.session')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], { queryParams: { sesion: 'expirada' } });
  });

  it('keeps the session on a network error while refreshing', async () => {
    await login();
    const request = firstValueFrom(client.get(`${API}/a`));
    http.expectOne(`${API}/a`).flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(`${API}/auth/refresh`).error(new ProgressEvent('error'));
    await expect(request).rejects.toBeTruthy();
    expect(localStorage.getItem('velo.session')).toBe('refresh-1');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('restores the session from a token saved before the Velo rename (and moves it)', async () => {
    localStorage.setItem('jfchat.refresh', 'refresh-9');
    const restored = store.restore();
    http.expectOne(`${API}/auth/refresh`).flush(session(user(1, 'ana'), 10));
    await restored;
    expect(store.isAuthenticated()).toBe(true);
    expect(store.token()).toBe('access-10');
    expect(localStorage.getItem('jfchat.refresh')).toBeNull();
    expect(localStorage.getItem('velo.session')).toBe('refresh-10');
  });

  it('revokes the refresh token on logout', async () => {
    await login();
    store.logout();
    expect(store.user()).toBeNull();
    expect(http.expectOne(`${API}/auth/logout`).request.body).toEqual({ refreshToken: 'refresh-1' });
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  describe('PIN', () => {
    it('seals the stored session with the PIN and resumes it only with the right one', async () => {
      await login();
      await store.enablePin('4821');
      const sealed = localStorage.getItem('velo.session')!;
      expect(sealed.startsWith('pin1.')).toBe(true);
      expect(sealed).not.toContain('refresh-1');
      expect(store.pinEnabled()).toBe(true);

      // A fresh start (new store) cannot use the sealed token without the PIN.
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(), { provide: API_URL, useValue: API }],
      });
      http = TestBed.inject(HttpTestingController);
      store = TestBed.inject(AuthStore);
      await store.restore();
      http.expectNone(`${API}/auth/refresh`);
      expect(store.hasPin()).toBe(true);
      await expect(store.unlockWithPin('0000')).resolves.toBe(false);

      const unlocked = store.unlockWithPin('4821');
      await vi.waitFor(() => http.expectOne(`${API}/auth/refresh`).flush(session(user(1, 'ana'), 2)));
      await expect(unlocked).resolves.toBe(true);
      expect(store.user()?.username).toBe('ana');
      // The rotated token is sealed again, never stored in clear.
      await vi.waitFor(() => expect(localStorage.getItem('velo.session')).not.toBe(sealed));
      expect(localStorage.getItem('velo.session')!.startsWith('pin1.')).toBe(true);
      expect(JSON.stringify(localStorage)).not.toContain('refresh-2');
    });

    it('removing the PIN needs the PIN and stores the session in clear again', async () => {
      await login();
      await store.enablePin('123456');
      await expect(store.disablePin('000000')).resolves.toBe(false);
      await expect(store.disablePin('123456')).resolves.toBe(true);
      expect(localStorage.getItem('velo.session')).toBe('refresh-1');
      expect(store.pinEnabled()).toBe(false);
    });
  });
});
