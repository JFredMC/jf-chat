// features/chat/layout/chat-layout.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { SweetAlertService } from '../../../services/sweet-alert.service';
import { ThemeService } from '../../../services/theme.service';

@Component({
  selector: 'app-chat-layout',
  imports: [CommonModule],
  templateUrl: './chat-layout.html',
  styleUrl: './chat-layout.scss'
})
export class ChatLayout {
  private readonly authService = inject(AuthService);
  private readonly sweetAlertService = inject(SweetAlertService);
  private readonly themeService = inject(ThemeService);

  protected currentUser = this.authService.currentUser;
  protected userInitials = this.authService.userInitials;
  protected userAvatarColor = this.authService.userAvatarColor;
  protected isDarkMode = this.themeService.isDarkMode;

  // Señales para controlar estados del UI
  protected isProfileMenuOpen = signal(false);
  protected isSidebarOpen = signal(false);
  protected isMobileMenuOpen = signal(false);

  toggleProfileMenu(): void {
    this.isProfileMenuOpen.update(value => !value);
  }

  toggleSidebar(): void {
    this.isSidebarOpen.update(value => !value);
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update(value => !value);
  }

  closeAllMenus(): void {
    this.isProfileMenuOpen.set(false);
    this.isSidebarOpen.set(false);
    this.isMobileMenuOpen.set(false);
  }

  toggleTheme(): void {
    this.themeService.toggleDarkMode();
    this.isProfileMenuOpen.set(false);
  }

  changeLanguage(lang: string): void {
    // Aquí implementarías el cambio de idioma
    console.log('Cambiar idioma a:', lang);
    this.isProfileMenuOpen.set(false);
  }

  handleLogout(): void {
    this.sweetAlertService.confirm(
      $localize`Cerrar sesión`,
      $localize`¿Estas seguro que deseas cerrar sesión?`,
    ).then((result) => {
      if (result.isConfirmed) {
        this.authService.logout();
      }
    });
  }

  getDisplayName(): string {
    const user = this.currentUser();
    if (user?.fist_name && user?.last_name) {
      return `${user.fist_name} ${user.last_name}`;
    }
    return user?.username || 'Usuario';
  }
}