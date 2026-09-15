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
    clientId: '3ac527f1-f433-4c0c-b518-aa0b5946294a',
    // Directory (tenant) ID de tu tenant Entra ID
    tenantId: 'ac1c32f1-bc10-4ded-b8c0-102ac9a1fd68',
    // URIs de redirección registradas en el App Registration SPA
    redirectUri: 'http://localhost:4200',
    postLogoutRedirectUri: 'http://localhost:4200',
  },
  api: {
    // Application ID URI del registro de la API "digitalfix-api" (ver PowerShell)
    scope: 'api://fb8ea665-ee45-4790-8112-eade3bd230e5/access_as_user',
    // Base URL del BFF. En local: http://localhost:8080
    // En AWS: la URL de tu API Gateway (HTTP API) + stage
    baseUrl: 'http://localhost:8080',
  },
};
