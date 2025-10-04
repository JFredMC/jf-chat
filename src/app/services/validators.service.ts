// validation.service.ts
import { Injectable, inject } from '@angular/core';
import { EXISTING_USERS, FORM_ERRORS } from '../types/errors';
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

@Injectable({ providedIn: 'root' })
export class ValidationService {
  private readonly errorMessages: any = inject(FORM_ERRORS);

  public getErrorMessage(errorKey: string, errorValue: any): string {
    const getError = this.errorMessages[errorKey];
    return getError ? getError(errorValue) : $localize`Error desconocido`;
  }

  public existingUserValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const username = control.value?.trim();
      if (username && EXISTING_USERS.includes(username)) {
        return { existingUser: true };
      }
      return null;
    };
  }

  // Validador de contraseña fuerte
  public strongPasswordValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      
      if (!value) {
        return null;
      }

      const hasUpperCase = /[A-Z]/.test(value);
      const hasLowerCase = /[a-z]/.test(value);
      const hasNumeric = /[0-9]/.test(value);
      const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value);

      const passwordValid = hasUpperCase && hasLowerCase && hasNumeric && hasSpecialChar;

      return !passwordValid ? { strongPassword: true } : null;
    };
  }

  // Método para obtener usuarios existentes
  public getExistingUsers(): string[] {
    return EXISTING_USERS;
  }
}