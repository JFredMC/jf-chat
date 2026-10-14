import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { BrandService } from '../ui/brand.service';

/**
 * What the decoy PIN opens: an ordinary-looking, empty Velo. No request is
 * made and nothing real is loaded. Leaving reloads the app (locked again).
 */
@Component({
  selector: 'app-decoy-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-dvh flex-col bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100" data-testid="decoy-home">
      <header class="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <span class="text-lg font-semibold">{{ brand.name() }}</span>
        <button type="button" class="btn-icon" (click)="leave()" aria-label="Cerrar sesión" title="Cerrar sesión">
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
          </svg>
        </button>
      </header>
      <div class="m-3 grid grid-cols-2 rounded-xl bg-gray-100 p-1 text-sm dark:bg-gray-900">
        <button type="button" class="rounded-lg py-1.5" [class.bg-white]="tab() === 'chats'" [class.dark:bg-gray-800]="tab() === 'chats'" (click)="tab.set('chats')">Chats</button>
        <button type="button" class="rounded-lg py-1.5" [class.bg-white]="tab() === 'contacts'" [class.dark:bg-gray-800]="tab() === 'contacts'" (click)="tab.set('contacts')">Contactos</button>
      </div>
      <div class="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-gray-500">
        @if (tab() === 'chats') {
          <p class="font-medium">Aún no tienes chats</p>
          <p class="text-sm">Cuando agregues un contacto, tus conversaciones aparecerán aquí.</p>
        } @else {
          <p class="font-medium">Sin contactos</p>
          <p class="text-sm">Pide a alguien su código de invitación para agregarlo.</p>
        }
      </div>
    </div>
  `,
})
export class DecoyHomeComponent {
  protected readonly brand = inject(BrandService);
  protected readonly tab = signal<'chats' | 'contacts'>('chats');

  protected leave(): void {
    location.reload();
  }
}
