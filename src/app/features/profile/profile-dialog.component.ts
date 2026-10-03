import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, model, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { errorMessage } from '../../core/api-error';
import { AuthStore } from '../../core/auth/auth.store';
import { ToastService } from '../../core/ui/toast.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { sameAs, strongPassword } from '../auth/validators';

@Component({
  selector: 'app-profile-dialog',
  imports: [ReactiveFormsModule, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      class="m-auto w-[min(30rem,calc(100%-2rem))] rounded-2xl bg-white p-0 text-gray-900 shadow-2xl backdrop:bg-black/50 dark:bg-gray-900 dark:text-gray-100"
      aria-labelledby="profile-title"
      (close)="open.set(false)"
    >
      <div class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
        <h2 id="profile-title" class="text-lg font-semibold">Tu perfil</h2>
        <button type="button" class="btn-icon" (click)="open.set(false)" aria-label="Cerrar">✕</button>
      </div>
      <div class="max-h-[75dvh] space-y-8 overflow-y-auto p-6">
        <div class="flex items-center gap-4">
          <app-avatar [user]="auth.user()" [size]="56" />
          <div>
            <p class="font-semibold">&#64;{{ auth.user()?.username }}</p>
            <p class="text-xs text-gray-500">Tu usuario no se puede cambiar.</p>
          </div>
        </div>

        <form class="space-y-4" [formGroup]="profile" (ngSubmit)="saveProfile()">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="label" for="p-first">Nombre</label>
              <input id="p-first" class="input" formControlName="first_name" maxlength="100" autocomplete="given-name" />
            </div>
            <div>
              <label class="label" for="p-last">Apellido</label>
              <input id="p-last" class="input" formControlName="last_name" maxlength="100" autocomplete="family-name" />
            </div>
          </div>
          <button type="submit" class="btn-primary" [disabled]="savingProfile() || profile.pristine">Guardar cambios</button>
        </form>

        <form class="space-y-4 border-t border-gray-200 pt-6 dark:border-gray-800" [formGroup]="password" (ngSubmit)="changePassword()">
          <h3 class="font-semibold">Cambiar contraseña</h3>
          <div>
            <label class="label" for="p-current">Contraseña actual</label>
            <input id="p-current" class="input" type="password" formControlName="current" autocomplete="current-password" />
          </div>
          <div>
            <label class="label" for="p-new">Nueva contraseña</label>
            <input id="p-new" class="input" type="password" formControlName="next" autocomplete="new-password"
              [class.input-invalid]="password.controls.next.invalid && password.controls.next.touched" aria-describedby="p-new-help" />
            <p id="p-new-help" class="mt-1.5 text-xs text-gray-500">Mínimo 8 caracteres, con mayúscula, minúscula y número.</p>
          </div>
          <div>
            <label class="label" for="p-confirm">Repite la nueva contraseña</label>
            <input id="p-confirm" class="input" type="password" formControlName="confirm" autocomplete="new-password"
              [class.input-invalid]="password.controls.confirm.invalid && password.controls.confirm.touched" />
            @if (password.controls.confirm.hasError('mismatch') && password.controls.confirm.touched) {
              <p class="field-error">Las contraseñas no coinciden.</p>
            }
          </div>
          <p class="text-xs text-gray-500">Al cambiarla se cerrará tu sesión en los demás dispositivos.</p>
          <button type="submit" class="btn-secondary" [disabled]="savingPassword()">Cambiar contraseña</button>
        </form>
      </div>
    </dialog>
  `,
})
export class ProfileDialogComponent {
  protected readonly auth = inject(AuthStore);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder).nonNullable;
  public readonly open = model(false);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly savingProfile = signal(false);
  protected readonly savingPassword = signal(false);
  protected readonly profile = this.fb.group({ first_name: [''], last_name: [''] });
  protected readonly password = this.fb.group({
    current: ['', Validators.required],
    next: ['', [Validators.required, strongPassword]],
    confirm: ['', [Validators.required, sameAs('next')]],
  });

  public constructor() {
    effect(() => {
      const element = this.dialog().nativeElement;
      if (this.open()) {
        const user = this.auth.user();
        this.profile.reset({ first_name: user?.first_name ?? '', last_name: user?.last_name ?? '' });
        this.password.reset();
        if (!element.open) element.showModal();
      } else if (element.open) {
        element.close();
      }
    });
  }

  protected saveProfile(): void {
    const { first_name, last_name } = this.profile.getRawValue();
    this.savingProfile.set(true);
    this.auth.updateProfile({ first_name: first_name.trim() || null, last_name: last_name.trim() || null }).subscribe({
      next: () => {
        this.savingProfile.set(false);
        this.profile.markAsPristine();
        this.toast.success('Perfil actualizado');
      },
      error: (error: unknown) => {
        this.savingProfile.set(false);
        this.toast.error(errorMessage(error));
      },
    });
  }

  protected changePassword(): void {
    this.password.markAllAsTouched();
    if (this.password.invalid) return;
    const { current, next } = this.password.getRawValue();
    this.savingPassword.set(true);
    this.auth.changePassword(current, next).subscribe({
      next: () => {
        this.savingPassword.set(false);
        this.password.reset();
        this.toast.success('Contraseña actualizada. Cerramos tus otras sesiones.');
      },
      error: (error: unknown) => {
        this.savingPassword.set(false);
        this.toast.error(errorMessage(error, 'No se pudo cambiar la contraseña'));
      },
    });
  }
}
