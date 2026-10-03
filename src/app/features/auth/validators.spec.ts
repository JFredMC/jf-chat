import { FormControl, FormGroup } from '@angular/forms';
import { firstValueFrom, of, throwError, type Observable } from 'rxjs';
import type { ValidationErrors } from '@angular/forms';
import { passwordScore, sameAs, strongPassword, usernameAvailable, usernameFormat } from './validators';

describe('auth validators', () => {
  it('accepts usernames with the API rules', () => {
    expect(usernameFormat(new FormControl('jhon.m_01'))).toBeNull();
    expect(usernameFormat(new FormControl('ab'))).toEqual({ usernameFormat: true });
    expect(usernameFormat(new FormControl('con espacio'))).toEqual({ usernameFormat: true });
    expect(usernameFormat(new FormControl(''))).toBeNull();
  });

  it('requires 8+ characters with upper, lower case and a digit', () => {
    expect(strongPassword(new FormControl('Secreta123'))).toBeNull();
    expect(strongPassword(new FormControl('secreta123'))).toEqual({ strongPassword: true });
    expect(strongPassword(new FormControl('Corta1'))).toEqual({ strongPassword: true });
  });

  it('checks the confirmation against the other field', () => {
    const form = new FormGroup({ password: new FormControl('Secreta123'), confirm: new FormControl('Otra1234', [sameAs('password')]) });
    expect(form.controls.confirm.errors).toEqual({ mismatch: true });
    form.controls.confirm.setValue('Secreta123');
    expect(form.controls.confirm.errors).toBeNull();
  });

  it('scores password strength', () => {
    expect(passwordScore('')).toBe(0);
    expect(passwordScore('Secreta1')).toBe(3);
    expect(passwordScore('Secreta123!')).toBe(4);
  });

  it('reports taken usernames and ignores network errors', async () => {
    vi.useFakeTimers();
    try {
      const run = (check: () => Observable<boolean>) => {
        const result = firstValueFrom(usernameAvailable(check)(new FormControl('Ana')) as Observable<ValidationErrors | null>);
        vi.advanceTimersByTime(400);
        return result;
      };
      expect(await run(() => of(false))).toEqual({ usernameTaken: true });
      expect(await run(() => of(true))).toBeNull();
      expect(await run(() => throwError(() => new Error('offline')))).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
