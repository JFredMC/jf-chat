import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="flex min-h-dvh flex-col items-center justify-center gap-4 bg-gray-50 p-6 text-center dark:bg-gray-950">
      <p class="text-6xl font-bold text-indigo-500">404</p>
      <h1 class="text-xl font-semibold text-gray-900 dark:text-white">Esta página no existe</h1>
      <a routerLink="/chat" class="btn-primary">Volver al chat</a>
    </main>
  `,
})
export class NotFoundPage {}
