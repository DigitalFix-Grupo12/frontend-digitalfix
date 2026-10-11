/**
 * Configuración central de la app (Microsoft Entra ID + backend).
 *
 * DigitalFix acepta usuarios de DOS tenants de Entra ID (uno por integrante).
 * Cada tenant tiene sus propios registros "digitalfix-frontend" (SPA) y
 * "digitalfix-api", y su propio API Gateway (el JWT authorizer de un HTTP API
 * admite un solo issuer). Ambos gateways apuntan al mismo BFF, que confía en
 * los dos issuers.
 *
 * Estos valores NO son secretos (client ID y tenant ID son públicos). Los
 * imprime digitalfix-infra/scripts/Setup-EntraTenant.ps1, se registran en
 * digitalfix-infra/config/tenants.json y Apply-Tenants.ps1 genera tenants.ts.
 */
import { TenantProfile } from './tenant-profile';
import { tenantProfiles } from './tenants';

export type { TenantProfile };
export { tenantProfiles };

const TENANT_STORAGE_KEY = 'digitalfix.tenant';

function storedTenantKey(): string | null {
  try {
    return localStorage.getItem(TENANT_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Guarda el tenant elegido. MSAL se configura una sola vez al arrancar la app,
 * así que después de cambiarlo hay que recargar la página.
 */
export function saveTenantKey(key: string): void {
  try {
    localStorage.setItem(TENANT_STORAGE_KEY, key);
  } catch {
    // almacenamiento bloqueado: se mantiene el tenant por defecto
  }
}

/** Tenant activo en esta carga de la app (por defecto, el primero). */
export const activeTenant: TenantProfile =
  tenantProfiles.find((t) => t.key === storedTenantKey()) ?? tenantProfiles[0];

export const appConfig = {
  azureAd: {
    clientId: activeTenant.spaClientId,
    tenantId: activeTenant.tenantId,
    // Se usa el origen actual: http://localhost:4200 en desarrollo y la URL de
    // AWS Amplify en la nube (ambas registradas en cada App Registration SPA).
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  api: {
    // Scope delegado expuesto por "digitalfix-api" del tenant activo.
    scope: `api://${activeTenant.apiClientId}/access_as_user`,
    // API Gateway del tenant activo -> BFF en EC2 -> microservicios.
    // Para probar contra un BFF local usar 'http://localhost:8080'.
    baseUrl: activeTenant.apiBaseUrl,
  },
};
