import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { errorMessage } from '../../core/api-error';
import { AuthStore } from '../../core/auth/auth.store';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Bienvenido de nuevo</h1>
    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Inicia sesión para seguir conversando.</p>

    @if (sesion() === 'expirada') {
      <p class="mt-4 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-100" role="status">
        Tu sesión expiró. Vuelve a iniciar sesión.
      </p>
    }
    @if (error()) {
      <p class="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200" role="alert">{{ error() }}</p>
    }

    <form class="mt-6 space-y-4" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <div>
        <label class="label" for="username">Usuario</label>
        <input id="username" class="input" formControlName="username" autocomplete="username" autocapitalize="none" spellcheck="false"
          [class.input-invalid]="invalid('username')" [attr.aria-invalid]="invalid('username')" aria-describedby="username-error" />
        @if (invalid('username')) {
          <p id="username-error" class="field-error">Escribe tu usuario.</p>
        }
      </div>
      <div>
        <label class="label" for="password">Contraseña</label>
        <div class="relative">
          <input id="password" class="input pr-12" formControlName="password" autocomplete="current-password"
            [type]="showPassword() ? 'text' : 'password'"
            [class.input-invalid]="invalid('password')" [attr.aria-invalid]="invalid('password')" aria-describedby="password-error" />
          <button type="button" class="absolute inset-y-0 right-0 px-3 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'">
            {{ showPassword() ? 'Ocultar' : 'Ver' }}
          </button>
        </div>
        @if (invalid('password')) {
          <p id="password-error" class="field-error">Escribe tu contraseña.</p>
        }
      </div>
      <button type="submit" class="btn-primary w-full" [disabled]="loading()">
        @if (loading()) {
          <span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true"></span>
          Entrando…
        } @else {
          Iniciar sesión
        }
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
      ¿No tienes cuenta?
      <a routerLink="/auth/register" class="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Regístrate</a>
    </p>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  /** ?sesion=expirada */
  public readonly sesion = input<string>();

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showPassword = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  protected invalid(name: 'username' | 'password'): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    const { username, password } = this.form.getRawValue();
    this.auth.login(username.trim(), password).subscribe({
      next: () => void this.router.navigate(['/chat']),
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(errorMessage(error, 'No se pudo iniciar sesión'));
      },
    });
  }
}
