import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Usuarios predefinidos
const USERS = ['Juan', 'Maria', 'Carlos', 'Ana', 'Pedro'];

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
  standalone: true, // Si estás usando componentes independientes
  imports: [CommonModule, FormsModule, RouterLink] // Importa FormsModule para ngModel
})
export class Login {
  username = '';
  error = '';

  constructor(private router: Router) {}

  handleLogin(): void {
    if (!this.username.trim()) {
      this.error = 'Por favor ingresa un nombre de usuario';
      return;
    }

    if (!USERS.includes(this.username)) {
      this.error = 'Usuario no encontrado. Por favor regístrate primero.';
      return;
    }

    localStorage.setItem('jfchat_username', this.username);
    this.router.navigate(['/']);
  }
}
