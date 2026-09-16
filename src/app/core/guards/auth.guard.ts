import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Exige sesion activa. A diferencia de MsalGuard (que redirige directo a
 * Microsoft), envia al usuario a la portada /login, donde inicia el flujo
 * Authorization Code + PKCE con un clic. El redirect de vuelta lo procesa
 * handleRedirectPromise() en el inicializador de la app.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? true : inject(Router).createUrlTree(['/login']);
};

/** En /login: si ya hay sesion, ir directo al dashboard. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? inject(Router).createUrlTree(['/dashboard']) : true;
};
