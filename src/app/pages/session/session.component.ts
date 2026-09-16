import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../core/ui/icon.component';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { appConfig } from '../../core/config/app-config';
import { AuthService, JwtClaims } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

interface ClaimRow { key: string; value: string; note: string; }
interface RouteProbe {
  method: string;
  path: string;
  roles: string;
  withToken?: number;
  withoutToken?: number;
  body?: string;
  running?: boolean;
}

/**
 * Evidencia de autenticacion: muestra el flujo OIDC (Authorization Code +
 * PKCE), los claims del ID token y del access token, y prueba cada ruta del
 * API Gateway con y sin token (200 / 401 / 403).
 */
@Component({
  selector: 'app-session',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './session.component.html',
})
export class SessionComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  authService = inject(AuthService);

  readonly config = appConfig;
  readonly authority = `https://login.microsoftonline.com/${appConfig.azureAd.tenantId}/v2.0`;

  accessToken = signal<string | null>(null);
  accessClaims = signal<JwtClaims | null>(null);
  tokenHeader = signal<JwtClaims | null>(null);
  idClaims = signal<JwtClaims | null>(null);
  now = signal(Date.now());
  error = signal<string | null>(null);
  private timer?: ReturnType<typeof setInterval>;

  probes = signal<RouteProbe[]>([
    { method: 'GET', path: '/api/workorders', roles: 'Admin, Supervisor, Cliente' },
    { method: 'GET', path: '/api/workorders/1', roles: 'Admin, Supervisor, Cliente (solo si es suya; si no, 404)' },
    { method: 'GET', path: '/api/catalog/services', roles: 'Admin, Supervisor' },
    { method: 'GET', path: '/api/report/kpis?range=last24h', roles: 'Admin' },
    { method: 'GET', path: '/api/audit', roles: 'Admin, Auditor' },
  ]);

  secondsLeft = computed(() => {
    const exp = Number(this.accessClaims()?.['exp'] ?? 0);
    return Math.max(0, Math.floor(exp - this.now() / 1000));
  });

  accessRows = computed<ClaimRow[]>(() => {
    const c = this.accessClaims();
    if (!c) return [];
    return [
      this.row(c, 'iss', 'Emisor: tenant de Entra ID (endpoint v2.0). Lo validan el API Gateway y el BFF.'),
      this.row(c, 'aud', 'Audiencia: Application ID de digitalfix-api. Lo validan el API Gateway y el BFF.'),
      this.row(c, 'scp', 'Scope delegado. El API Gateway exige access_as_user.'),
      this.row(c, 'roles', 'App Roles. El BFF autoriza cada endpoint con ellos.'),
      this.row(c, 'azp', 'Cliente que pidio el token (digitalfix-frontend).'),
      this.row(c, 'preferred_username', 'Usuario. El BFF lo propaga a auditoria (X-User-Name).'),
      this.row(c, 'iat', 'Emitido', true),
      this.row(c, 'nbf', 'No valido antes de', true),
      this.row(c, 'exp', 'Expira (vigencia validada por Gateway y BFF)', true),
      this.row(c, 'ver', 'Version del token'),
    ];
  });

  idRows = computed<ClaimRow[]>(() => {
    const c = this.idClaims();
    if (!c) return [];
    return [
      this.row(c, 'iss', 'Emisor'),
      this.row(c, 'aud', 'Audiencia: client ID del SPA'),
      this.row(c, 'nonce', 'Nonce del request OIDC (MSAL lo compara contra el enviado: anti-replay)'),
      this.row(c, 'name', 'Nombre'),
      this.row(c, 'oid', 'Object ID del usuario en el tenant'),
      this.row(c, 'tid', 'Tenant ID'),
    ];
  });

  async ngOnInit(): Promise<void> {
    this.timer = setInterval(() => this.now.set(Date.now()), 1000);
    this.idClaims.set(this.authService.getIdTokenClaims());
    await this.loadToken();
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async loadToken(): Promise<void> {
    try {
      const result = await this.authService.acquireApiToken();
      if (!result) return;
      this.accessToken.set(result.accessToken);
      this.accessClaims.set(this.authService.decodeJwt(result.accessToken));
      this.tokenHeader.set(this.authService.decodeHeader(result.accessToken));
    } catch (e) {
      this.error.set(`No se pudo obtener el access token: ${(e as Error).message}`);
    }
  }

  async copyToken(): Promise<void> {
    const token = this.accessToken();
    if (!token) return;
    await navigator.clipboard.writeText(token);
    this.toast.success('Access token copiado. Úsalo como Bearer en Postman o en Test-ApiGateway.ps1.');
  }

  async runProbes(): Promise<void> {
    const list: RouteProbe[] = this.probes().map((p) => ({
      method: p.method, path: p.path, roles: p.roles, running: true,
    }));
    this.probes.set(list);
    for (const p of list) {
      const url = `${appConfig.api.baseUrl}${p.path}`;
      // 1) Con token: el MsalInterceptor adjunta el Bearer automaticamente
      try {
        const res = await firstValueFrom(this.http.get(url, { observe: 'response', responseType: 'text' }));
        p.withToken = res.status;
        p.body = (res.body ?? '').slice(0, 140);
      } catch (e) {
        const err = e as HttpErrorResponse;
        p.withToken = err.status;
        p.body = typeof err.error === 'string' ? err.error.slice(0, 140) : '';
      }
      // 2) Sin token: fetch directo (no pasa por el interceptor)
      try {
        const res = await fetch(url);
        p.withoutToken = res.status;
      } catch {
        p.withoutToken = 0;
      }
      p.running = false;
      this.probes.set([...list]);
    }
  }

  statusClass(code?: number): string {
    if (code === undefined) return '';
    if (code >= 200 && code < 300) return 'badge badge--done';
    if (code === 401 || code === 403) return 'badge badge--progress';
    return 'badge badge--danger';
  }

  readonly flowSteps = [
    { icon: 'key', title: 'PKCE', text: 'MSAL genera code_verifier y su hash code_challenge (S256), además de state y nonce.' },
    { icon: 'lock', title: '/authorize', text: 'Redirección a Entra ID. El usuario se autentica (contraseña + MFA).' },
    { icon: 'check', title: 'Código', text: 'Entra devuelve un authorization code; MSAL valida el state.' },
    { icon: 'refresh', title: '/token', text: 'Se canjea el code enviando el code_verifier. Sin secreto de cliente.' },
    { icon: 'gateway', title: 'API Gateway', text: 'JWT Authorizer valida firma, exp, issuer, audience y scope.' },
    { icon: 'server', title: 'BFF', text: 'Spring Security revalida el token y autoriza por App Role.' },
  ];

  formatExpiry(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  }

  private row(c: JwtClaims, key: string, note: string, isDate = false): ClaimRow {
    const raw = c[key];
    let value: string;
    if (raw === undefined) value = '—';
    else if (isDate) value = new Date(Number(raw) * 1000).toLocaleString('es-CL');
    else if (Array.isArray(raw)) value = raw.join(', ');
    else value = String(raw);
    return { key, value, note };
  }
}
