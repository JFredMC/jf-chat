// features/chat/layout/chat-layout.ts
import { Component, inject } from '@angular/core';

import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { SweetAlertService } from '../../../services/sweet-alert.service';

@Component({
  selector: 'app-chat-layout',
  imports: [CommonModule],
  templateUrl: './chat-layout.html',
  styleUrl: './chat-layout.scss'
})
export class ChatLayout {
  private readonly authService = inject(AuthService);
  private readonly sweetAlertService = inject(SweetAlertService);

  protected currentUser = this.authService.currentUser;
  protected userInitials = this.authService.userInitials;

  handleLogout(): void {
    this.sweetAlertService.confirm(
      $localize`Cerrar sesión`,
      $localize`¿Estas seguro que deseas cerrar sesión?`,
    ).then((result) => {
      if (result.isConfirmed) {
        this.authService.logout();
      }
    })

  }
}