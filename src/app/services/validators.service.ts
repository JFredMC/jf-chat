// validation.service.ts
import { Injectable, Inject, InjectionToken } from '@angular/core';
import { FORM_ERRORS } from '../types/errors';

@Injectable({ providedIn: 'root' })
export class ValidationService {
  constructor(@Inject(FORM_ERRORS) private errorMessages: any) {}

  getErrorMessage(errorKey: string, errorValue: any): string {
    const getError = this.errorMessages[errorKey];
    return getError ? getError(errorValue) : $localize`Error desconocido`;
  }
}