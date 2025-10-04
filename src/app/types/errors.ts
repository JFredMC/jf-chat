import { InjectionToken } from "@angular/core";
import { ValidationErrors } from "@angular/forms";

export const FORM_ERRORS = new InjectionToken('FORM_ERRORS', {
  providedIn: 'root',
  factory: () => ({
    required: () => $localize`Este campo es requerido`,
    minlength: (error: ValidationErrors) => 
      $localize`Debe tener al menos ${error['requiredLength']} caracteres`,
    // Agrega más validadores según necesites
  })
});
