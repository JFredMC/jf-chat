import { Routes } from '@angular/router';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { authGuard } from './cores/guards/auth.guard';
import { ChatLayout } from './features/chat/layout/chat-layout';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full',
    title: 'JfChat'
  },
  {
    path: 'login',
    component: Login,
    title: 'Login'
  },
  {
    path: 'register',
    component: Register,
    title: 'Register'
  },
  {
    path: 'chat',
    component: ChatLayout,
    canActivate: [authGuard],
    title: 'Chat',
    children: [
    ]
  }
]
