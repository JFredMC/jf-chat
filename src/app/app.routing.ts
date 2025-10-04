import { Routes } from '@angular/router';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';

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
];