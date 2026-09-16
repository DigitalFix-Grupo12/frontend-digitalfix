import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ApiService, Kpis } from '../../core/services/api.service';
import { WorkOrderStatus } from '../../core/services/workorders.service';
import { IconComponent } from '../../core/ui/icon.component';
import { STATUS_META, formatDateTime, httpErrorMessage, statusLabel } from '../../core/ui/format';

const STATUS_COLOR: Record<WorkOrderStatus, string> = {
  CREADA: '#5b9dff',
  ASIGNADA: '#a78bfa',
  EN_DESPLAZAMIENTO: '#f5a524',
  EN_EJECUCION: '#fb923c',
  CERRADA: '#34d399',
  CANCELADA: '#7b879d',
};

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './reports.component.html',
})
export class ReportsComponent implements OnInit {
  private api = inject(ApiService);
  readonly fmt = formatDateTime;

  range = signal<'last24h' | 'last7d'>('last24h');
  kpis = signal<Kpis | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  maxSerie = computed(() => Math.max(1, ...(this.kpis()?.serie ?? []).map((p) => p.ordenes)));

  states = computed(() => {
    const por = this.kpis()?.porEstado ?? {};
    return (Object.keys(STATUS_META) as WorkOrderStatus[])
      .map((s) => ({ status: s, label: statusLabel(s), n: por[s] ?? 0, color: STATUS_COLOR[s] }))
      .filter((s) => s.n > 0);
  });

  totalStates = computed(() => this.states().reduce((a, s) => a + s.n, 0));

  donut = computed(() => {
    const total = this.totalStates();
    if (!total) return 'conic-gradient(var(--surface-3) 0 100%)';
    let acc = 0;
    const stops = this.states().map((s) => {
      const from = (acc / total) * 100;
      acc += s.n;
      return `${s.color} ${from}% ${(acc / total) * 100}%`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  });

  completion = computed(() => {
    const k = this.kpis();
    const total = this.totalStates();
    return k && total ? Math.round(((k.porEstado['CERRADA'] ?? 0) / total) * 100) : 0;
  });

  ngOnInit(): void {
    this.load();
  }

  setRange(r: 'last24h' | 'last7d'): void {
    if (r === this.range()) return;
    this.range.set(r);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.kpis(this.range()).subscribe({
      next: (k) => {
        this.kpis.set(k);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(httpErrorMessage(err));
        this.loading.set(false);
      },
    });
  }

  barHeight(v: number): number {
    return Math.max(2, (v / this.maxSerie()) * 100);
  }
}
