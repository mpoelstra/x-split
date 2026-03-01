import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { APP_ENV } from '../env/app-env.token';

export const authGuard: CanActivateFn = async () => {
  const env = inject(APP_ENV);
  if (env.authBypass) {
    return true;
  }

  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.init();

  if (auth.user()) {
    return true;
  }

  return router.parseUrl('/login');
};
