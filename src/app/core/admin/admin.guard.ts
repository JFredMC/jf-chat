import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AdminApi } from './admin.api';

/** Hidden route: non-admins are sent back to the chat as if it did not exist. */
export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AdminApi)
    .isAdmin()
    .pipe(map((ok) => ok || router.createUrlTree(['/chat'])));
};
