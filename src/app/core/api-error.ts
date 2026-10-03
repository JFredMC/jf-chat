import { HttpErrorResponse } from '@angular/common/http';

/** Turns any HTTP error into a short Spanish message for the UI. */
export function errorMessage(error: unknown, fallback = 'Algo salió mal, inténtalo de nuevo'): string {
  if (!(error instanceof HttpErrorResponse)) {
    return error instanceof Error && error.message ? error.message : fallback;
  }
  if (error.status === 0) return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
  if (error.status === 429) return 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.';
  if (error.status === 413) return 'El archivo es demasiado grande (máximo 10 MB).';
  if (error.status >= 500) return 'El servidor tuvo un problema. Inténtalo más tarde.';
  const body = error.error as { message?: string | string[] } | null;
  const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
  return message || fallback;
}
