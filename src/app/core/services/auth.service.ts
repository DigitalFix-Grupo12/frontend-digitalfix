import { Injectable, inject, signal } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { AccountInfo } from '@azure/msal-browser';
import { appConfig } from '../config/app-config';

/**
 * Roles del caso DigitalFix. Deben coincidir EXACTAMENTE con los App Roles
 * definidos en el App Registration (Manifest > appRoles) y con los que
 * el script Register-EntraApps.ps1 crea y asigna a los usuarios de prueba.
 */
export type DigitalFixRole = 'Admin' | 'Supervisor' | 'Cliente' | 'Auditor';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private msalService = inject(MsalService);

  /**
   * Los App Roles del caso están definidos en digitalfix-api (el recurso),
   * NO en digitalfix-frontend (el cliente). Por eso NO aparecen en el ID
   * token (audience = cliente) -- solo aparecen en el ACCESS TOKEN pedido
   * para el scope de la API (audience = digitalfix-api). Este es el MISMO
   * token que el BFF valida, así que frontend y backend quedan mirando
   * exactamente la misma fuente de verdad para los roles.
   */
  private rolesSignal = signal<DigitalFixRole[]>([]);

  login(): void {
    this.msalService.loginRedirect();
  }

  logout(): void {
    this.msalService.logoutRedirect();
  }

  isLoggedIn(): boolean {
    return this.getActiveAccount() !== null;
  }

  getActiveAccount(): AccountInfo | null {
    try {
      const active = this.msalService.instance.getActiveAccount();
      if (active) return active;

      const accounts = this.msalService.instance.getAllAccounts();
      if (accounts.length > 0) {
        this.msalService.instance.setActiveAccount(accounts[0]);
        return accounts[0];
      }
      return null;
    } catch {
      // MSAL aún no ha terminado de inicializar
      return null;
    }
  }

  /**
   * Pide (silenciosamente) un access token para la API y decodifica su
   * claim "roles". Hay que llamarlo después del login y al recargar la
   * página con una sesión ya activa (ver App.ngOnInit). Como usa un
   * signal, la nav y los guards se actualizan solos en cuanto resuelve.
   */
  async refreshRoles(): Promise<void> {
    const account = this.getActiveAccount();
    if (!account) {
      this.rolesSignal.set([]);
      return;
    }
    try {
      const result = await this.msalService.instance.acquireTokenSilent({
        scopes: [appConfig.api.scope],
        account,
      });
      const claims = this.decodeJwt(result.accessToken) as { roles?: string[] } | null;
      this.rolesSignal.set((claims?.roles ?? []) as DigitalFixRole[]);
    } catch {
      this.rolesSignal.set([]);
    }
  }

  getRoles(): DigitalFixRole[] {
    return this.rolesSignal();
  }

  hasRole(...allowed: DigitalFixRole[]): boolean {
    const roles = this.getRoles();
    return allowed.some((r) => roles.includes(r));
  }

  getDisplayName(): string {
    return this.getActiveAccount()?.name ?? this.getActiveAccount()?.username ?? '';
  }

  private decodeJwt(token: string): unknown {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  }
}
