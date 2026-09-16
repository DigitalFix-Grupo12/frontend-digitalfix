import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ApiService, AuditEvent, Kpis } from '../../core/services/api.service';
import { WorkOrder, WorkOrderStatus, WorkordersService } from '../../core/services/workorders.service';
import { IconComponent } from '../../core/ui/icon.component';
import { STATUS_META, badgeClass, statusLabel, timeAgo } from '../../core/ui/format';

const TONE_COLOR: Record<string, string> = {
  open: 'var(--blue)',
  progress: 'var(--amber)',
  done: 'var(--green)',
  cancel: 'var(--gray)',
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, IconComponent],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  auth = inject(AuthService);
  private api = inject(ApiService);
  private workorders = inject(WorkordersService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly badgeClass = badgeClass;
  readonly statusLabel = statusLabel;
  readonly timeAgo = timeAgo;

  orders = signal<WorkOrder[] | null>(null);
  kpis = signal<Kpis | null>(null);
  events = signal<AuditEvent[] | null>(null);
  denied = signal<string | null>(null);

  readonly greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  })();
  readonly today = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });

  firstName = computed(() => (this.auth.getDisplayName() || '').split(/[\s@]/)[0]);
  canOrders = computed(() => this.auth.hasRole('Admin', 'Supervisor', 'Cliente'));
  isCustomer = computed(() => this.auth.hasRole('Cliente') && !this.auth.hasRole('Admin', 'Supervisor'));
  hasAnyRole = computed(() => this.auth.getRoles().length > 0);

  private count = (pred: (o: WorkOrder) => boolean) => computed(() => (this.orders() ?? []).filter(pred).length);
  active = this.count((o) => !['CERRADA', 'CANCELADA'].includes(o.status));
  pending = this.count((o) => o.status === 'CREADA');
  inField = this.count((o) => ['ASIGNADA', 'EN_DESPLAZAMIENTO', 'EN_EJECUCION'].includes(o.status));
  closed = this.count((o) => o.status === 'CERRADA');

  recent = computed(() => (this.orders() ?? []).slice(0, 6));

  distribution = computed(() => {
    const list = this.orders() ?? [];
    const total = list.length || 1;
    return (Object.keys(STATUS_META) as WorkOrderStatus[])
      .map((s) => {
        const n = list.filter((o) => o.status === s).length;
        return { status: s, label: statusLabel(s), n, pct: (n / total) * 100, color: TONE_COLOR[STATUS_META[s].tone] };
      })
      .filter((d) => d.n > 0);
  });

  async ngOnInit(): Promise<void> {
    const denied = this.route.snapshot.queryParamMap.get('denied');
    if (denied) this.denied.set(denied);

    if (this.auth.getRoles().length === 0) await this.auth.refreshRoles();

    if (this.canOrders()) {
      this.workorders.list().subscribe({
        next: (d) => this.orders.set(d),
        error: () => this.orders.set([]),
      });
    }
    if (this.auth.hasRole('Admin')) {
      this.api.kpis('last24h').subscribe({ next: (k) => this.kpis.set(k), error: () => this.kpis.set(null) });
    }
    if (this.auth.hasRole('Admin', 'Auditor')) {
      this.api.audit({ limit: 6 }).subscribe({ next: (e) => this.events.set(e), error: () => this.events.set([]) });
    }
  }

  dismissDenied(): void {
    this.denied.set(null);
    void this.router.navigate([], { queryParams: {} });
  }

  newOrder(): void {
    void this.router.navigate(['/workorders'], { queryParams: { nueva: 1 } });
  }
}
