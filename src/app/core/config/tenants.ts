// Generado por digitalfix-infra/scripts/Apply-Tenants.ps1 desde config/tenants.json.
// No editar a mano: actualiza tenants.json y vuelve a ejecutar el script.
import { TenantProfile } from './tenant-profile';

export const tenantProfiles: TenantProfile[] = [
  {
    key: 'kevin',
    label: 'Tenant Kevin',
    domain: 'digitalfixkevin.onmicrosoft.com',
    tenantId: '4ad1987c-6ddd-48a8-ab99-6fb918e84464',
    spaClientId: 'ddf8e70d-db7d-489e-bc96-c1bfec7d8910',
    apiClientId: 'ed8785f9-fb12-437b-9816-1982aab623e7',
    apiBaseUrl: 'https://7s6qn2mb8h.execute-api.us-east-1.amazonaws.com',
  },
];
