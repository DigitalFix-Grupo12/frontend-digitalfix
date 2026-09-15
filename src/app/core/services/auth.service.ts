import { Injectable, inject } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { AccountInfo } from '@azure/msal-browser';

/**
 * Roles del caso DigitalFix. Deben coincidir EXACTAMENTE con los App Roles
 * definidos en el App Registration (Manifest > appRoles) y con los que
 * el script Register-EntraApps.ps1 crea y asigna a los usuarios de prueba.
 */
export type DigitalFixRole = 'Admin' | 'Supervisor' | 'Cliente' | 'Auditor';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private msalService = inject(MsalService);

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
   * Lee los roles desde el claim "roles" del ID token (App Roles asignados
   * al usuario en Entra ID). Este claim solo aparece si el App Registration
   * tiene App Roles definidos y el usuario tiene al menos uno asignado.
   */
  getRoles(): DigitalFixRole[] {
    const account = this.getActiveAccount();
    const claims = account?.idTokenClaims as { roles?: string[] } | undefined;
    return (claims?.roles ?? []) as DigitalFixRole[];
  }

  hasRole(...allowed: DigitalFixRole[]): boolean {
    const roles = this.getRoles();
    return allowed.some((r) => roles.includes(r));
  }

  getDisplayName(): string {
    return this.getActiveAccount()?.name ?? this.getActiveAccount()?.username ?? '';
  }
}
