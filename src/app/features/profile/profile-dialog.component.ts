import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, model, signal, untracked, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { errorMessage } from '../../core/api-error';
import { AuthStore } from '../../core/auth/auth.store';
import { STATUS_MESSAGE_MAX } from '../../core/models';
import { ToastService } from '../../core/ui/toast.service';
import { AVATAR_ACCEPT, avatarFileError, cropAvatar } from '../../shared/avatar-image';
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
        <h2 id="profile-title" class="text-lg font-semibold">Mi perfil</h2>
        <button type="button" class="btn-icon" (click)="open.set(false)" aria-label="Cerrar">✕</button>
      </div>
      <div class="max-h-[75dvh] space-y-8 overflow-y-auto p-6">
        <section class="flex flex-col items-center gap-4 sm:flex-row sm:items-start" aria-labelledby="photo-title">
          <div class="relative">
            @if (preview(); as url) {
              <img [src]="url" alt="Vista previa de tu nueva foto" class="h-24 w-24 rounded-full object-cover ring-4 ring-indigo-500/40" data-testid="avatar-preview" />
            } @else {
              <app-avatar [user]="auth.user()" [size]="96" />
            }
          </div>
          <div class="min-w-0 flex-1 text-center sm:text-left">
            <h3 id="photo-title" class="font-semibold">Foto de perfil</h3>
            <p class="text-sm text-gray-500">&#64;{{ auth.user()?.username }} · tu usuario no se puede cambiar.</p>
            <p id="photo-help" class="mt-1 text-xs text-gray-500">JPG, PNG o WebP de hasta 5 MB. Se recorta al centro en forma cuadrada.</p>
            <input #fileInput type="file" class="sr-only" [accept]="accept" (change)="pick($event)" aria-describedby="photo-help" data-testid="avatar-input" id="avatar-input" />
            <div class="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              @if (pending()) {
                <button type="button" class="btn-primary px-3 py-1.5 text-sm" (click)="savePhoto()" [disabled]="savingPhoto()" data-testid="avatar-save">
                  {{ savingPhoto() ? 'Subiendo…' : 'Guardar foto' }}
                </button>
                <button type="button" class="btn-secondary px-3 py-1.5 text-sm" (click)="cancelPhoto()" [disabled]="savingPhoto()">Cancelar</button>
              } @else {
                <button type="button" class="btn-secondary px-3 py-1.5 text-sm" (click)="fileInput.click()" data-testid="avatar-change">
                  {{ auth.user()?.avatar_url ? 'Cambiar foto' : 'Subir foto' }}
                </button>
                @if (auth.user()?.avatar_url) {
                  <button type="button" class="px-3 py-1.5 text-sm font-medium text-rose-600 hover:underline dark:text-rose-400" (click)="removePhoto()" [disabled]="savingPhoto()" data-testid="avatar-remove">Quitar foto</button>
                }
              }
            </div>
            @if (photoError()) {
              <p class="field-error" role="alert" data-testid="avatar-error">{{ photoError() }}</p>
            }
          </div>
        </section>

        <form class="space-y-3 border-t border-gray-200 pt-6 dark:border-gray-800" (submit)="$event.preventDefault(); saveStatus()" aria-labelledby="status-title">
          <h3 id="status-title" class="font-semibold">Estado personal</h3>
          <p class="text-xs text-gray-500">Lo ven tus amigos y contactos en sus chats.</p>
          <div class="flex flex-wrap gap-1.5" role="group" aria-label="Agregar un emoji al estado">
            @for (emoji of emojis; track emoji) {
              <button type="button" class="btn-icon h-9 w-9 text-lg" (click)="addEmoji(emoji)" [attr.aria-label]="'Agregar ' + emoji">{{ emoji }}</button>
            }
          </div>
          <div>
            <label class="label" for="p-status">¿Qué estás haciendo?</label>
            <input id="p-status" class="input" [value]="status()" (input)="status.set($any($event.target).value)" [attr.maxlength]="statusMax"
              placeholder="Ej.: 🎧 Concentrado, respondo luego" aria-describedby="p-status-count" data-testid="status-input" />
            <p id="p-status-count" class="mt-1 text-right text-xs" [class]="statusLength() > statusMax ? 'text-rose-600' : 'text-gray-500'" aria-live="polite">
              {{ statusLength() }}/{{ statusMax }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="submit" class="btn-primary" [disabled]="savingStatus() || !statusChanged() || statusLength() > statusMax" data-testid="status-save">Guardar estado</button>
            @if (auth.user()?.status_message) {
              <button type="button" class="btn-secondary" (click)="clearStatus()" [disabled]="savingStatus()" data-testid="status-clear">Borrar estado</button>
            }
          </div>
        </form>

        <form class="space-y-4 border-t border-gray-200 pt-6 dark:border-gray-800" [formGroup]="profile" (ngSubmit)="saveProfile()">
          <h3 class="font-semibold">Nombre</h3>
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

  protected readonly accept = AVATAR_ACCEPT;
  protected readonly statusMax = STATUS_MESSAGE_MAX;
  protected readonly emojis = ['😊', '🎧', '💼', '📚', '🏃', '✈️', '🎉', '😴'];
  protected readonly pending = signal<{ blob: Blob; extension: string } | null>(null);
  protected readonly preview = signal<string | null>(null);
  protected readonly photoError = signal<string | null>(null);
  protected readonly savingPhoto = signal(false);
  protected readonly status = signal('');
  protected readonly savingStatus = signal(false);
  protected readonly statusLength = computed(() => this.status().trim().length);
  protected readonly statusChanged = computed(() => this.status().trim() !== (this.auth.user()?.status_message ?? ''));
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  public constructor() {
    inject(DestroyRef).onDestroy(() => this.cancelPhoto());
    effect(() => {
      const element = this.dialog().nativeElement;
      if (this.open()) {
        // Only when opening: later profile updates must not reset what is being edited.
        const user = untracked(() => this.auth.user());
        this.profile.reset({ first_name: user?.first_name ?? '', last_name: user?.last_name ?? '' });
        this.password.reset();
        this.status.set(user?.status_message ?? '');
        this.photoError.set(null);
        if (!element.open) element.showModal();
      } else {
        this.cancelPhoto();
        if (element.open) element.close();
      }
    });
  }

  protected async pick(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.photoError.set(avatarFileError(file));
    if (this.photoError()) return;
    try {
      const cropped = await cropAvatar(file);
      this.cancelPhoto();
      this.pending.set(cropped);
      this.preview.set(URL.createObjectURL(cropped.blob));
    } catch {
      this.photoError.set('No pudimos leer esa imagen. Prueba con otra.');
    }
  }

  protected cancelPhoto(): void {
    const url = this.preview();
    if (url) URL.revokeObjectURL(url);
    this.preview.set(null);
    this.pending.set(null);
  }

  protected savePhoto(): void {
    const pending = this.pending();
    if (!pending) return;
    this.savingPhoto.set(true);
    this.auth.uploadAvatar(pending.blob, `avatar.${pending.extension}`).subscribe({
      next: () => {
        this.savingPhoto.set(false);
        this.cancelPhoto();
        this.toast.success('Foto de perfil actualizada');
      },
      error: (error: unknown) => {
        this.savingPhoto.set(false);
        this.photoError.set(errorMessage(error, 'No se pudo subir la foto'));
      },
    });
  }

  protected removePhoto(): void {
    this.savingPhoto.set(true);
    this.auth.removeAvatar().subscribe({
      next: () => {
        this.savingPhoto.set(false);
        this.toast.success('Foto eliminada');
        this.fileInput().nativeElement.focus();
      },
      error: (error: unknown) => {
        this.savingPhoto.set(false);
        this.toast.error(errorMessage(error, 'No se pudo quitar la foto'));
      },
    });
  }

  protected addEmoji(emoji: string): void {
    const current = this.status().trim();
    const next = current ? `${emoji} ${current}` : `${emoji} `;
    if (next.trim().length <= this.statusMax) this.status.set(next);
    document.getElementById('p-status')?.focus();
  }

  protected saveStatus(): void {
    this.updateStatus(this.status().trim() || null, 'Estado actualizado');
  }

  protected clearStatus(): void {
    this.status.set('');
    this.updateStatus(null, 'Estado borrado');
  }

  private updateStatus(value: string | null, done: string): void {
    this.savingStatus.set(true);
    this.auth.updateProfile({ status_message: value }).subscribe({
      next: (user) => {
        this.savingStatus.set(false);
        this.status.set(user.status_message ?? '');
        this.toast.success(done);
      },
      error: (error: unknown) => {
        this.savingStatus.set(false);
        this.toast.error(errorMessage(error, 'No se pudo guardar el estado'));
      },
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
