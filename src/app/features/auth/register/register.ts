import { Component, inject, signal, Signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ControlErrors } from '../../errors/control-errors/control-errors';
import { ValidationService } from '../../../services/validators.service';
import { UsersService } from '../../user/services/user.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { SweetAlertService } from '../../../services/sweet-alert.service';
import { map } from 'rxjs';

@Component({
  selector: 'app-register',
  templateUrl: './register.html',
  styleUrls: ['./register.scss'],
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink, ControlErrors]
})
export class Register {
  private readonly fb = inject(FormBuilder);
  private readonly validationService = inject(ValidationService);
  private readonly sweetAlertService = inject(SweetAlertService);
  private readonly usersService = inject(UsersService);

  public registerForm: FormGroup;
  public isLoading: Signal<boolean>;
  public isLoadingBtn: Signal<boolean>;
  public showPassword = signal<boolean>(false);
  public existingUsers = toSignal(
  this.usersService.getAll().pipe(
    map(users => users.map(user => user.username))
  ), 
    { initialValue: [] }
  );

  constructor() {
    this.isLoading = this.usersService.isLoading;
    this.isLoadingBtn = this.usersService.isLoadingBtn;
    this.registerForm = this.fb.group({
      username: ['', [
        Validators.required,
        Validators.minLength(3),
        this.validationService.existingUserValidator(this.existingUsers)
      ]],
      password: ['', [
        Validators.required, 
        Validators.minLength(8),
        this.validationService.strongPasswordValidator()
      ]],
    });
  }

  handleRegister(): void {
    this.registerForm.markAllAsTouched();

    if (this.registerForm.valid) {
      const { username, password } = this.registerForm.value;
  
      this.usersService.register({ username, password }).subscribe({
        next: (response) => {
          this.sweetAlertService.showAlert(
            $localize`Registro de usuario`,
            $localize`¡Usuario registrado exitosamente!`,
          )
          this.resetForm();
        },
        error: (error) => {
          this.sweetAlertService.showAlert(
            $localize`Registro de usuario`,
            error
          )
        }
      });
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword.set(!this.showPassword());
  }

  resetForm() {
    this.registerForm.reset();
  }

  get username() {
    return this.registerForm.get('username');
  }

  get password() {
    return this.registerForm.get('password');
  }
}