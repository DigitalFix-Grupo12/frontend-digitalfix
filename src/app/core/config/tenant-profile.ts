export interface TenantProfile {
  /** Identificador interno (se guarda en localStorage). */
  key: string;
  /** Texto del selector en la pantalla de login. */
  label: string;
  /** Dominio inicial del tenant (solo informativo). */
  domain: string;
  /** Directory (tenant) ID. */
  tenantId: string;
  /** Application (client) ID del registro SPA "digitalfix-frontend". */
  spaClientId: string;
  /** Application (client) ID del registro "digitalfix-api". */
  apiClientId: string;
  /** URL del API Gateway (HTTP API) cuyo JWT authorizer confía en este tenant. */
  apiBaseUrl: string;
}
