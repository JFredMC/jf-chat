// validation.service.ts
import { Injectable, Inject, InjectionToken } from '@angular/core';
import { EXISTING_USERS, FORM_ERRORS } from '../types/errors';
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

@Injectable({ providedIn: 'root' })
export class ValidationService {
  constructor(@Inject(FORM_ERRORS) private errorMessages: any) {}

  getErrorMessage(errorKey: string, errorValue: any): string {
    const getError = this.errorMessages[errorKey];
    return getError ? getError(errorValue) : $localize`Error desconocido`;
  }

  existingUserValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const username = control.value?.trim();
      if (username && EXISTING_USERS.includes(username)) {
        return { existingUser: true };
      }
      return null;
    };
  }

  // Método para obtener usuarios existentes (si se necesita en el template)
  getExistingUsers(): string[] {
    return EXISTING_USERS;
  }
}