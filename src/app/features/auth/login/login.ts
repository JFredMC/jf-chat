// login.component.ts
import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ControlErrors } from '../../errors/control-errors/control-errors';
import { ValidationService } from '../../../services/validators.service';
import { AuthService } from '../../../services/auth.service';
import { SweetAlertService } from '../../../services/sweet-alert.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
  imports: [CommonModule, ReactiveFormsModule, ControlErrors, RouterLink],
})
export class Login {
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly validationService = inject(ValidationService);
  private readonly authService = inject(AuthService);
  private readonly sweetAlertService = inject(SweetAlertService);
  
  public isLoadingBtn = this.authService.isLoadingBtn;
  public form = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [
      Validators.required, 
      Validators.minLength(8),
      this.validationService.strongPasswordValidator()
    ]],
  });

  constructor() {
    effect(() => {
      this.isLoadingBtn.set(this.authService.isLoadingBtn());
    });
  }

  handleLogin(): void {
    if (this.form.valid) {
      const { username, password } = this.form.value;
      if(username && password) {
        this.authService.login({ username, password }).subscribe({
          next: (response) => {
            this.router.navigate(['/chat']);
          },
          error: (error) => {
            this.sweetAlertService.showAlert(
              $localize`Inicio de sesión`,
              error
            )
          }
        });
      }
    } else {
      this.form.markAllAsTouched();
    }
  }

  get username() {
    return this.form.get('username');
  }

  get password() {
    return this.form.get('password');
  }
}