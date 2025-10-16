// chat-actions.component.ts
import { Component, input, output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConversationService } from '../../../conversations/services/conversation.service';
import { SweetAlertService } from '../../../../../services/sweet-alert.service';
import { IConversation } from '../../../conversations/types/conversation.type';


@Component({
  selector: 'app-chat-actions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chat-actions.html',
  styleUrl: './chat-actions.scss'
})
export class ChatActions {
  private readonly conversationService = inject(ConversationService);
  private readonly sweetAlertService = inject(SweetAlertService);

  // Inputs
  public conversation = input.required<IConversation>();
  
  // Outputs
  public viewContact = output<void>();
  public deleteConversation = output<void>();

  // Señales locales
  public isOptionsMenuOpen = signal<boolean>(false);

  // Métodos públicos para el template padre
  toggleOptionsMenu(): void {
    this.isOptionsMenuOpen.update(open => !open);
  }

  closeOptionsMenu(): void {
    this.isOptionsMenuOpen.set(false);
  }

  // Método para manejar la eliminación de conversación
  onDeleteConversation(): void {
    const conversation = this.conversation();
    if (!conversation) return;

    this.sweetAlertService.confirm(
      $localize`Eliminar conversación`,
      $localize`¿Estás seguro de que quieres eliminar esta conversación?`,
      $localize`Sí`,
      $localize`Cancelar`,
    ).then((result) => {
      if (result.isConfirmed) {
        this.conversationService.deleteConversation(conversation.id!).subscribe({
          next: () => {
            this.deleteConversation.emit();
            this.closeOptionsMenu();
          },
          error: (error) => {
            console.error('Error al eliminar la conversación:', error);
            this.closeOptionsMenu();
          }
        });
      }
    });
  }

  // Método para manejar ver contacto
  onViewContact(): void {
    this.viewContact.emit();
    this.closeOptionsMenu();
  }

  // Método para cerrar menús al hacer click fuera
  closeAllMenus(): void {
    this.closeOptionsMenu();
  }
}
