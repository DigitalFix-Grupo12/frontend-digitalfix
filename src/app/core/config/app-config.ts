/**
 * Configuración central de la app (Azure Entra ID + API Gateway).
 *
 * IMPORTANTE: estos valores NO son secretos (Client ID y Tenant ID son públicos),
 * pero sí son específicos de tu registro de aplicación. El script
 * `scripts/Register-EntraApps.ps1` los imprime al final de su ejecución;
 * cópialos aquí tal cual.
 *
 * Para producción, reemplaza esto por un fetch a /assets/config.json generado
 * en el pipeline de build, así no hardcodeas IDs por ambiente.
 */
export const appConfig = {
  azureAd: {
    // Application (client) ID del registro SPA "digitalfix-frontend"
    clientId: 'REEMPLAZA_CON_TU_SPA_CLIENT_ID',
    // Directory (tenant) ID de tu tenant Entra ID
    tenantId: 'REEMPLAZA_CON_TU_TENANT_ID',
    // URIs de redirección registradas en el App Registration SPA
    redirectUri: 'http://localhost:4200',
    postLogoutRedirectUri: 'http://localhost:4200',
  },
  api: {
    // Application ID URI del registro de la API "digitalfix-api" (ver PowerShell)
    // Ej: api://11111111-2222-3333-4444-555555555555
    scope: 'api://REEMPLAZA_CON_TU_API_CLIENT_ID/access_as_user',
    // Base URL del BFF. En local: http://localhost:8080
    // En AWS: la URL de tu API Gateway (HTTP API) + stage
    baseUrl: 'http://localhost:8080',
  },
};
