import { Routes } from '@angular/router';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { authGuard } from './cores/guards/auth.guard';
import { ChatLayout } from './features/chat/chat-layout/chat-layout';
import { NotFoundComponent } from './features/errors/404/404';
import { guestGuard } from './cores/guards/guest.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full'
  },
  {
    path: 'auth',
    canActivate: [guestGuard],
    children: [
      {
        path: 'login',
        component: Login,
        title: 'Login - JfChat'
      },
      {
        path: 'register',
        component: Register,
        title: 'Register - JfChat'
      }
    ]
  },
  {
    path: 'chat',
    component: ChatLayout,
    canActivate: [authGuard],
    title: 'Chat - JfChat',
    children: []
  },
  {
    path: '**',
    component: NotFoundComponent,
    title: 'Página no encontrada - JfChat'
  }
];
