import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, DigitalFixRole } from '../services/auth.service';

/**
 * Guard de autorización por rol. Se usa DESPUÉS de MsalGuard en la cadena
 * de canActivate (MsalGuard ya garantiza que el usuario está autenticado).
 *
 * Uso en las rutas:
 *   { path: 'reports', component: ReportsComponent,
 *     canActivate: [MsalGuard, roleGuard], data: { roles: ['Admin'] } }
 */
export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const requiredRoles = (route.data?.['roles'] ?? []) as DigitalFixRole[];
  if (requiredRoles.length === 0) return true;

  if (authService.hasRole(...requiredRoles)) return true;

  router.navigate(['/dashboard'], { queryParams: { accessDenied: route.routeConfig?.path } });
  return false;
};
