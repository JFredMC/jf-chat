import { AbstractControl, AsyncValidatorFn, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Observable, catchError, map, of, switchMap, timer } from 'rxjs';

/** Same rules as the API (RegisterDto). */
export const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;

export const usernameFormat: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '').trim().toLowerCase();
  if (!value) return null;
  return USERNAME_PATTERN.test(value) ? null : { usernameFormat: true };
};

export const strongPassword: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '');
  if (!value) return null;
  const ok = value.length >= 8 && value.length <= 72 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value);
  return ok ? null : { strongPassword: true };
};

export const sameAs =
  (otherField: string): ValidatorFn =>
  (control: AbstractControl): ValidationErrors | null => {
    const other = control.parent?.get(otherField)?.value as unknown;
    return control.value && control.value !== other ? { mismatch: true } : null;
  };

/** Debounced server check; network errors don't block the form (the API answers 409 anyway). */
export const usernameAvailable =
  (check: (username: string) => Observable<boolean>): AsyncValidatorFn =>
  (control: AbstractControl): Observable<ValidationErrors | null> => {
    const value = String(control.value ?? '').trim().toLowerCase();
    if (!USERNAME_PATTERN.test(value)) return of(null);
    return timer(400).pipe(
      switchMap(() => check(value)),
      map((available) => (available ? null : { usernameTaken: true })),
      catchError(() => of(null)),
    );
  };

/** Password strength 0-4 for the meter. */
export function passwordScore(value: string): number {
  let score = 0;
  if (value.length >= 8) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (value.length >= 12 || /[^A-Za-z0-9]/.test(value)) score++;
  return score;
}
