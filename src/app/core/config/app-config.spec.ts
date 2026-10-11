import { activeTenant, appConfig, tenantProfiles } from './app-config';

/** Contrato de la configuración multi-tenant (Kevin y Boris). */
describe('Configuración de tenants', () => {
  it('cada tenant tiene IDs propios y su propio API Gateway', () => {
    expect(tenantProfiles.length).toBeGreaterThanOrEqual(1);
    const keys = new Set(tenantProfiles.map((t) => t.key));
    const gateways = new Set(tenantProfiles.map((t) => t.apiBaseUrl));
    expect(keys.size).toBe(tenantProfiles.length);
    expect(gateways.size).toBe(tenantProfiles.length);
    for (const t of tenantProfiles) {
      expect(t.apiBaseUrl).toMatch(/^https:\/\//);
    }
  });

  it('sin selección guardada usa el primer tenant', () => {
    expect(activeTenant).toBe(tenantProfiles[0]);
  });

  it('MSAL y el scope se derivan del tenant activo', () => {
    expect(appConfig.azureAd.clientId).toBe(activeTenant.spaClientId);
    expect(appConfig.azureAd.tenantId).toBe(activeTenant.tenantId);
    expect(appConfig.api.scope).toBe(`api://${activeTenant.apiClientId}/access_as_user`);
    expect(appConfig.api.baseUrl).toBe(activeTenant.apiBaseUrl);
  });
});
