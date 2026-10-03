import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/guards';

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
        title: 'Iniciar sesión · JfChat',
        loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
      },
      {
        path: 'register',
        title: 'Crear cuenta · JfChat',
        loadComponent: () => import('./features/auth/register.page').then((m) => m.RegisterPage),
      },
    ],
  },
  {
    path: 'chat',
    title: 'JfChat',
    canActivate: [authGuard],
    loadComponent: () => import('./features/chat/chat-shell.component').then((m) => m.ChatShellComponent),
  },
  // Old links (the previous version used /login).
  { path: 'login', redirectTo: 'auth/login' },
  {
    path: '**',
    title: 'Página no encontrada · JfChat',
    loadComponent: () => import('./features/not-found.page').then((m) => m.NotFoundPage),
  },
];
