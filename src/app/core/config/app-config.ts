/**
 * Configuración central de la app (Azure Entra ID + backend).
 *
 * IMPORTANTE: estos valores NO son secretos (Client ID y Tenant ID son públicos),
 * pero sí son específicos de tu registro de aplicación. El script
 * `scripts/Register-EntraApps.ps1` los imprime al final de su ejecución;
 * cópialos aquí tal cual.
 */
export const appConfig = {
  azureAd: {
    // Application (client) ID del registro SPA "digitalfix-frontend"
    clientId: '3ac527f1-f433-4c0c-b518-aa0b5946294a',
    // Directory (tenant) ID de tu tenant Entra ID
    tenantId: 'ac1c32f1-bc10-4ded-b8c0-102ac9a1fd68',
    // URIs de redirección registradas en el App Registration SPA
    // Se usa el origen actual: http://localhost:4200 en desarrollo y la URL
    // de AWS Amplify en la nube (ambas registradas en el App Registration SPA).
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  api: {
    // Application ID URI del registro de la API "digitalfix-api" (ver PowerShell)
    scope: 'api://fb8ea665-ee45-4790-8112-eade3bd230e5/access_as_user',
    // AWS API Gateway (HTTP API) -> BFF en EC2 -> microservicios.
    // Para probar contra un BFF local usar 'http://localhost:8080'.
    baseUrl: 'https://7s6qn2mb8h.execute-api.us-east-1.amazonaws.com',
  },
};
