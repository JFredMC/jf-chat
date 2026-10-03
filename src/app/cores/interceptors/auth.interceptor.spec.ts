import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => backend.verify());

  it('adds the bearer token when there is one', () => {
    localStorage.setItem('jfchat_token', 'abc');
    http.get('/api/conversation').subscribe();
    const req = backend.expectOne('/api/conversation');
    expect(req.request.headers.get('Authorization')).toBe('Bearer abc');
    req.flush([]);
  });

  it('ends the session locally on 401 without calling the logout endpoint again', () => {
    localStorage.setItem('jfchat_token', 'expired');
    const endSession = vi.spyOn(auth, 'endSession');
    http.get('/api/conversation').subscribe({ error: () => undefined });
    backend.expectOne('/api/conversation').flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(endSession).toHaveBeenCalledTimes(1);
    backend.expectNone((req) => req.url.includes('/auth/logout'));
  });

  it('does not treat wrong credentials on login as an expired session', () => {
    const endSession = vi.spyOn(auth, 'endSession');
    http.post('/api/auth/login', {}).subscribe({ error: () => undefined });
    backend.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(endSession).not.toHaveBeenCalled();
  });
});
