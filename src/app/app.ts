import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MsalBroadcastService } from '@azure/msal-angular';
import { EventMessage, EventType } from '@azure/msal-browser';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { AuthService, DigitalFixRole } from './core/services/auth.service';
import { ApiService } from './core/services/api.service';
import { ToastTrayComponent } from './core/components/toast/toast-tray.component';
import { IconComponent } from './core/ui/icon.component';
import { initials } from './core/ui/format';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  roles?: DigitalFixRole[];
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastTrayComponent, IconComponent],
  templateUrl: './app.html',
})
export class App implements OnInit, OnDestroy {
  private msalBroadcast = inject(MsalBroadcastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  authService = inject(AuthService);
  api = inject(ApiService);

  private destroy$ = new Subject<void>();
  private healthTimer?: ReturnType<typeof setInterval>;

  pageTitle = signal('Dashboard');
  menuOpen = signal(false);

  readonly operations: NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: 'grid' },
    { path: '/workorders', label: 'Órdenes de trabajo', icon: 'wrench', roles: ['Admin', 'Supervisor', 'Cliente'] },
    { path: '/catalog', label: 'Catálogo técnico', icon: 'package', roles: ['Admin', 'Supervisor'] },
  ];
  readonly analytics: NavItem[] = [
    { path: '/reports', label: 'Reportería', icon: 'chart', roles: ['Admin'] },
    { path: '/audit', label: 'Auditoría', icon: 'history', roles: ['Admin', 'Auditor'] },
  ];
  readonly security: NavItem[] = [{ path: '/session', label: 'Mi sesión y token', icon: 'key' }];

  visibleAnalytics = computed(() => this.analytics.filter((i) => this.canSee(i)));
  userInitials = computed(() => initials(this.authService.getDisplayName() || '?'));

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) void this.authService.refreshRoles();

    this.msalBroadcast.msalSubject$
      .pipe(
        takeUntil(this.destroy$),
        filter((m: EventMessage) => m.eventType === EventType.LOGIN_SUCCESS)
      )
      .subscribe(() => {
        this.authService.getActiveAccount();
        void this.authService.refreshRoles();
      });

    this.router.events
      .pipe(takeUntil(this.destroy$), filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        let r = this.route.snapshot;
        while (r.firstChild) r = r.firstChild;
        this.pageTitle.set((r.data?.['title'] as string) ?? 'DigitalFix');
        this.menuOpen.set(false);
      });

    void this.api.checkHealth();
    this.healthTimer = setInterval(() => void this.api.checkHealth(), 60_000);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.healthTimer) clearInterval(this.healthTimer);
  }

  canSee(item: NavItem): boolean {
    return !item.roles || this.authService.hasRole(...item.roles);
  }

  logout(): void {
    this.authService.logout();
  }
}
