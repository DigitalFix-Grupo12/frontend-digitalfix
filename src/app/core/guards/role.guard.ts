import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, DigitalFixRole } from '../services/auth.service';

/**
 * Autorizacion por rol en el frontend (UX). La autorizacion real la aplican
 * el API Gateway y el BFF; este guard solo evita mostrar pantallas sin permiso.
 * Si los roles aun no se leyeron del access token (recarga de pagina), los espera.
 */
export const roleGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const required = (route.data?.['roles'] ?? []) as DigitalFixRole[];
  if (required.length === 0) return true;

  if (auth.getRoles().length === 0) await auth.refreshRoles();
  if (auth.hasRole(...required)) return true;

  return router.createUrlTree(['/dashboard'], { queryParams: { denied: route.routeConfig?.path } });
};
