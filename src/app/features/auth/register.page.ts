import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { startWith } from 'rxjs';
import { errorMessage } from '../../core/api-error';
import { AuthStore } from '../../core/auth/auth.store';
import { passwordScore, sameAs, strongPassword, usernameAvailable, usernameFormat } from './validators';

const STRENGTH = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Excelente'];
const STRENGTH_COLOR = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-lime-500', 'bg-emerald-500'];

@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Crea tu cuenta</h1>
    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Solo un usuario y una contraseña. Sin nombre, sin correo, sin teléfono.</p>

    @if (error()) {
      <p class="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200" role="alert">{{ error() }}</p>
    }

    <form class="mt-6 space-y-4" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <div>
        <label class="label" for="username">Usuario</label>
        <input id="username" class="input" formControlName="username" autocomplete="username" autocapitalize="none" spellcheck="false"
          [class.input-invalid]="usernameError()" [attr.aria-invalid]="!!usernameError()" aria-describedby="username-help" />
        <p id="username-help" class="mt-1.5 text-xs" [class]="usernameError() ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'" aria-live="polite">
          @if (usernameError(); as message) {
            {{ message }}
          } @else if (form.controls.username.pending) {
            Comprobando disponibilidad…
          } @else if (form.controls.username.valid) {
            <span class="text-emerald-600 dark:text-emerald-400">✓ Disponible</span>
          } @else {
            3 a 30 caracteres: minúsculas, números, punto o guion bajo. Mejor si no revela quién eres.
          }
        </p>
      </div>

      <div>
        <label class="label" for="password">Contraseña</label>
        <input id="password" class="input" type="password" formControlName="password" autocomplete="new-password"
          [class.input-invalid]="invalid('password')" [attr.aria-invalid]="invalid('password')" aria-describedby="password-help" />
        <div class="mt-2 flex gap-1" aria-hidden="true">
          @for (i of [0, 1, 2, 3]; track i) {
            <span class="h-1 flex-1 rounded-full" [class]="i < score() ? strengthColor() : 'bg-gray-200 dark:bg-gray-700'"></span>
          }
        </div>
        <p id="password-help" class="mt-1.5 text-xs" [class]="invalid('password') ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'">
          @if (passwordValue()) {
            Seguridad: {{ strengthLabel() }}.
          }
          Mínimo 8 caracteres, con mayúscula, minúscula y número.
        </p>
      </div>

      <div>
        <label class="label" for="confirm">Repite la contraseña</label>
        <input id="confirm" class="input" type="password" formControlName="confirm" autocomplete="new-password"
          [class.input-invalid]="invalid('confirm')" [attr.aria-invalid]="invalid('confirm')" aria-describedby="confirm-error" />
        @if (invalid('confirm')) {
          <p id="confirm-error" class="field-error">Las contraseñas no coinciden.</p>
        }
      </div>

      <button type="submit" class="btn-primary w-full" [disabled]="loading()">
        {{ loading() ? 'Creando cuenta…' : 'Crear cuenta' }}
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
      ¿Ya tienes cuenta?
      <a routerLink="/auth/login" class="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Inicia sesión</a>
    </p>
  `,
})
export class RegisterPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    username: ['', [Validators.required, usernameFormat], [usernameAvailable((name) => this.auth.isUsernameAvailable(name))]],
    password: ['', [Validators.required, strongPassword]],
    confirm: ['', [Validators.required, sameAs('password')]],
  });

  protected readonly passwordValue = toSignal(this.form.controls.password.valueChanges.pipe(startWith('')), { initialValue: '' });
  protected readonly score = computed(() => passwordScore(this.passwordValue()));
  protected readonly strengthLabel = computed(() => STRENGTH[this.score()]);
  protected readonly strengthColor = computed(() => STRENGTH_COLOR[this.score()]);
  private readonly usernameStatus = toSignal(this.form.controls.username.statusChanges, { initialValue: 'INVALID' });

  protected readonly usernameError = computed(() => {
    this.usernameStatus();
    const control = this.form.controls.username;
    if (!control.touched && !control.dirty) return null;
    if (control.hasError('required')) return 'Elige un nombre de usuario.';
    if (control.hasError('usernameFormat')) return 'Usa 3 a 30 caracteres: minúsculas, números, punto o guion bajo.';
    if (control.hasError('usernameTaken')) return 'Ese usuario ya existe. Prueba con otro.';
    return null;
  });

  public constructor() {
    // Re-check the confirmation when the password changes.
    this.form.controls.password.valueChanges.subscribe(() => this.form.controls.confirm.updateValueAndValidity({ emitEvent: false }));
  }

  protected invalid(name: 'password' | 'confirm'): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.form.pending || this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    const { username, password } = this.form.getRawValue();
    this.auth
      .register({ username: username.trim().toLowerCase(), password })
      .subscribe({
        next: () => void this.router.navigate(['/chat']),
        error: (error: unknown) => {
          this.loading.set(false);
          this.error.set(errorMessage(error, 'No se pudo crear la cuenta'));
        },
      });
  }
}
