// register.component.ts
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ControlErrors } from '../../errors/control-errors/control-errors';
import { ValidationService } from '../../../services/validators.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.html',
  styleUrls: ['./register.scss'],
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink, ControlErrors]
})
export class Register {
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly validationService = inject(ValidationService);

  public registerForm: FormGroup;
  success = false;
  existingUsers = this.validationService.getExistingUsers();

  constructor() {
    this.registerForm = this.fb.group({
      username: ['', [
        Validators.required,
        Validators.minLength(3),
        this.validationService.existingUserValidator()
      ]],
      password: ['', [
        Validators.required, 
        Validators.minLength(8),
        this.validationService.strongPasswordValidator()
      ]],
    });
  }

  get username() {
    return this.registerForm.get('username');
  }

  handleRegister(): void {
    this.registerForm.markAllAsTouched();

    if (this.registerForm.valid) {
      const usernameValue = this.username?.value;
      
      this.success = true;
      localStorage.setItem('jfchat_username', usernameValue);

      setTimeout(() => {
        this.router.navigate(['/']);
      }, 1500);
    }
  }
}