import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

// Usuarios predefinidos
const EXISTING_USERS = ['Juan', 'Maria', 'Carlos', 'Ana', 'Pedro'];

@Component({
  selector: 'app-register',
  templateUrl: './register.html',
  styleUrls: ['./register.scss'],
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink]
})
export class Register {
  username = '';
  error = '';
  success = false;
  existingUsers = EXISTING_USERS;

  constructor(private router: Router) {}

  handleRegister(): void {
    // Reiniciar estado de error
    this.error = '';

    if (!this.username.trim()) {
      this.error = 'Por favor ingresa un nombre de usuario';
      return;
    }

    if (this.username.length < 3) {
      this.error = 'El nombre de usuario debe tener al menos 3 caracteres';
      return;
    }

    if (EXISTING_USERS.includes(this.username)) {
      this.error = 'Este usuario ya existe. Por favor elige otro nombre.';
      return;
    }

    // Simular registro exitoso
    this.success = true;
    localStorage.setItem('jfchat_username', this.username);

    // Redirigir después de 1.5 segundos
    setTimeout(() => {
      this.router.navigate(['/']);
    }, 1500);
  }
}