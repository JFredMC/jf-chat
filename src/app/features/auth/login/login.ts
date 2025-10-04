// login.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ControlErrors } from '../../errors/control-errors/control-errors';
import { ValidationService } from '../../../services/validators.service';

const USERS = ['Juan', 'Maria', 'Carlos', 'Ana', 'Pedro'];

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
  imports: [CommonModule, ReactiveFormsModule, ControlErrors, RouterLink],
})
export class Login implements OnInit {
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly validationService = inject(ValidationService);
  
  public form = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [
      Validators.required, 
      Validators.minLength(8),
      this.validationService.strongPasswordValidator()
    ]],
  });

  ngOnInit() {}

  handleLogin(): void {
    if (this.form.valid) {
      this.router.navigate(['/']);
    } else {
      // Marcar todos los campos como touched para mostrar errores
      this.form.markAllAsTouched();
      Object.keys(this.form.controls).forEach(key => {
        this.form.get(key)?.markAsDirty();
      });
    }
  }

  get username() {
    return this.form.get('username');
  }

  get password() {
    return this.form.get('password');
  }
}