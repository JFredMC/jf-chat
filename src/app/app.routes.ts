import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/guards';
import { IS_DEMO } from './core/config';

/**
 * With PAGES_MODE=api the demo is a separate build under /jf-chat/demo/.
 * GitHub Pages sends unknown demo deep links to the root app's 404.html:
 * hand them over to the demo with a full page load.
 */
const openDemoBuild = () => {
  if (inject(IS_DEMO)) return false;
  const document = inject(DOCUMENT);
  document.location.replace(new URL('demo/', document.baseURI).href);
  return false;
};

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'chat' },
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/auth-layout.component').then((m) => m.AuthLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'login' },
      {
        path: 'login',
        title: 'Iniciar sesión',
        loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
      },
      {
        path: 'register',
        title: 'Crear cuenta',
        loadComponent: () => import('./features/auth/register.page').then((m) => m.RegisterPage),
      },
    ],
  },
  {
    path: 'chat',
    canActivate: [authGuard],
    loadComponent: () => import('./features/chat/chat-shell.component').then((m) => m.ChatShellComponent),
  },
  { path: 'demo', canMatch: [openDemoBuild], children: [] },
  // Old links (the previous version used /login).
  { path: 'login', redirectTo: 'auth/login' },
  {
    path: '**',
    title: 'Página no encontrada',
    loadComponent: () => import('./features/not-found.page').then((m) => m.NotFoundPage),
  },
];
