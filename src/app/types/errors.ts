import { InjectionToken } from "@angular/core";
import { ValidationErrors } from "@angular/forms";

export const FORM_ERRORS = new InjectionToken('FORM_ERRORS', {
  providedIn: 'root',
  factory: () => ({
    required: () => $localize`Este campo es requerido`,
    minlength: (error: ValidationErrors) => $localize`Debe tener al menos ${error['requiredLength']} caracteres`,
    existingUser: () => $localize`Este usuario ya existe. Por favor elige otro nombre.`,
    strongPassword: () => $localize`La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial.`,
  })
});

export const EXISTING_USERS = ['Juan', 'Maria', 'Carlos', 'Ana', 'Pedro'];

