import { Routes } from '@angular/router';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { authGuard } from './cores/guards/auth.guard';
import { ChatLayout } from './features/chat/layout/chat-layout';
import { NotFoundComponent } from './features/errors/404/404';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full'
  },
  {
    path: 'auth',
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
    redirectTo: 'auth/login',
    component: NotFoundComponent,
    title: 'Página no encontrada - JfChat'
  }
];
