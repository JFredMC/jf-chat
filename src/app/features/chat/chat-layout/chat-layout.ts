import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { SweetAlertService } from '../../../services/sweet-alert.service';
import { ThemeService } from '../../../services/theme.service';
import { UsersService } from '../../user/services/user.service';
import { LanguageService } from '../../../services/language.service';
import { ChatArea } from '../chat-area/chat-area';
import { FriendshipDialog } from '../../friendship/friendship-dialog/friendship-dialog';
import { ChatService } from '../services/chat.service';
import { ConversationList } from '../conversation-list/conversation-list';
import { ConversationService } from '../conversations/services/conversation.service';
import { FriendshipService } from '../../friendship/services/friendship.service';
import { IConversation } from '../conversations/types/conversation.type';
import { IUser } from '../../../types/user';

// chat-layout.ts
@Component({
  selector: 'app-chat-layout',
  imports: [CommonModule, ChatArea, FriendshipDialog, ConversationList],
  templateUrl: './chat-layout.html',
  styleUrl: './chat-layout.scss'
})
export class ChatLayout {
  private readonly authService = inject(AuthService);
  private readonly usersService = inject(UsersService);
  private readonly sweetAlertService = inject(SweetAlertService);
  private readonly themeService = inject(ThemeService);
  private readonly languageService = inject(LanguageService);
  private readonly conversationService = inject(ConversationService);
  private readonly friendshipService = inject(FriendshipService);

  protected currentUser = this.authService.currentUser;
  protected userInitials = this.usersService.userInitials;
  protected userAvatarColor = this.usersService.userAvatarColor;
  protected activeConversation = this.conversationService.activeConversation;
  protected isDarkMode = computed(() => this.themeService.isDarkMode());
  protected isContactsDialogOpen = signal(false);
  
  // Señales para los idiomas
  protected currentLanguage = this.languageService.language;
  protected isLanguageMenuOpen = signal(false);

  // Señales para controlar estados del UI
  protected isProfileMenuOpen = signal(false);
  protected isSidebarOpen = signal(false);
  protected isMobileMenuOpen = signal(false);

  constructor() {
    // Cargar conversaciones al inicializar
    this.loadConversations();
  }

  loadConversations(): void {
    this.conversationService.getUserConversations().subscribe();
  }

  toggleProfileMenu(): void {
    this.isProfileMenuOpen.update(value => !value);
  }

  toggleLanguageMenu(): void {
    this.isLanguageMenuOpen.update(value => !value);
  }

  toggleSidebar(): void {
    this.isSidebarOpen.update(value => !value);
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update(value => !value);
  }

  closeAllMenus(): void {
    this.isProfileMenuOpen.set(false);
    this.isLanguageMenuOpen.set(false);
    this.isSidebarOpen.set(false);
    this.isMobileMenuOpen.set(false);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  changeLanguage(lang: 'es' | 'en'): void {
    this.languageService.setLanguage(lang);
    this.isLanguageMenuOpen.set(false);
  }

  getLanguageName(lang: 'es' | 'en'): string {
    return this.languageService.getLanguageName(lang);
  }

  getLanguageFlag(lang: 'es' | 'en'): string {
    return this.languageService.getLanguageFlag(lang);
  }

  handleLogout(): void {
    this.sweetAlertService.confirm(
      $localize`Cerrar sesión`,
      $localize`¿Estas seguro que deseas cerrar sesión?`,
      $localize`Si`,
      $localize`Cancelar`,
    ).then((result) => {
      if (result.isConfirmed) {
        this.authService.logout();
      }
    });
  }

  getDisplayName(): string {
    const user = this.currentUser();
    if (user?.first_name && user?.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user?.username || 'Usuario';
  }

  openContactsDialog(): void {
    this.isContactsDialogOpen.set(true);
  }

  closeContactsDialog(): void {
    this.isContactsDialogOpen.set(false);
  }

  onFriendSelected(selected: {friendId: string, friendData: IUser}): void {
    this.startChatWithFriend(selected.friendData.id!);
    this.closeContactsDialog();
  }

  private startChatWithFriend(friendId: number) {
    this.conversationService.getOrCreateDirectConversation(friendId).subscribe({
      next: (conversation) => {
      },
    });
  }

  // Método para seleccionar una conversación existente
  selectConversation(conversation: IConversation): void {
    this.conversationService.setActiveConversation(conversation);
    this.isMobileMenuOpen.set(false);
  }
}