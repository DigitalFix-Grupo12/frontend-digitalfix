import { Injectable, inject, signal } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { AccountInfo, AuthenticationResult } from '@azure/msal-browser';
import { appConfig } from '../config/app-config';

/**
 * Roles del caso DigitalFix. Deben coincidir EXACTAMENTE con los App Roles
 * definidos en el App Registration de la API (digitalfix-api).
 */
export type DigitalFixRole = 'Admin' | 'Supervisor' | 'Cliente' | 'Auditor';

export type JwtClaims = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private msalService = inject(MsalService);

  /**
   * Los App Roles viven en digitalfix-api (el recurso), por eso aparecen en el
   * ACCESS TOKEN pedido para el scope de la API, no en el ID token. Es el mismo
   * token que validan el API Gateway y el BFF. Un usuario sin rol asignado no
   * obtiene permisos (principio de minimo privilegio).
   */
  private rolesSignal = signal<DigitalFixRole[]>([]);

  /** OIDC Authorization Code + PKCE: MSAL genera code_verifier/code_challenge (S256), state y nonce. */
  login(): void {
    this.msalService.loginRedirect({ scopes: [appConfig.api.scope] });
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
      // MSAL aun no termina de inicializar
      return null;
    }
  }

  /** Access token para la API (silencioso; MSAL lo renueva si esta por vencer). */
  async acquireApiToken(): Promise<AuthenticationResult | null> {
    const account = this.getActiveAccount();
    if (!account) return null;
    return this.msalService.instance.acquireTokenSilent({ scopes: [appConfig.api.scope], account });
  }

  /**
   * Lee el claim "roles" del access token. Se llama despues del login y al
   * recargar con sesion activa (ver App.ngOnInit). Al ser un signal, la nav
   * y los guards se actualizan solos.
   */
  async refreshRoles(): Promise<void> {
    try {
      const result = await this.acquireApiToken();
      const roles = result ? (this.decodeJwt(result.accessToken)?.['roles'] as string[] | undefined) : undefined;
      this.rolesSignal.set((roles ?? []) as DigitalFixRole[]);
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

  getIdTokenClaims(): JwtClaims | null {
    return (this.getActiveAccount()?.idTokenClaims as JwtClaims | undefined) ?? null;
  }

  decodeJwt(token: string): JwtClaims | null {
    return this.decodePart(token, 1);
  }

  decodeHeader(token: string): JwtClaims | null {
    return this.decodePart(token, 0);
  }

  private decodePart(token: string, index: number): JwtClaims | null {
    try {
      const b64 = token.split('.')[index].replace(/-/g, '+').replace(/_/g, '/');
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes)) as JwtClaims;
    } catch {
      return null;
    }
  }
}
