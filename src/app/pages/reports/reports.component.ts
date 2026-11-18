import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ApiService, Kpis, LiveReport } from '../../core/services/api.service';
import { WorkOrderStatus } from '../../core/services/workorders.service';
import { IconComponent } from '../../core/ui/icon.component';
import { STATUS_META, formatDateTime, httpErrorMessage, statusLabel, timeAgo } from '../../core/ui/format';

const STATUS_COLOR: Record<WorkOrderStatus, string> = {
  CREADA: '#5b9dff',
  ASIGNADA: '#a78bfa',
  EN_DESPLAZAMIENTO: '#f5a524',
  EN_EJECUCION: '#fb923c',
  CERRADA: '#34d399',
  CANCELADA: '#7b879d',
};

const EVENT_LABEL: Record<string, string> = {
  CREATED: 'Creada',
  ASSIGNED: 'Asignada',
  STATUS_CHANGED: 'Cambio de estado',
  CLOSED: 'Cerrada',
  CANCELLED: 'Cancelada',
};

/** Cada cuanto se consulta el panel en vivo (la proyeccion se actualiza con cada evento Kafka). */
const LIVE_INTERVAL_MS = 4000;

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './reports.component.html',
})
export class ReportsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private timer?: ReturnType<typeof setInterval>;
  private clock?: ReturnType<typeof setInterval>;
  readonly fmt = formatDateTime;
  readonly ago = timeAgo;

  range = signal<'last24h' | 'last7d'>('last24h');
  kpis = signal<Kpis | null>(null);
  live = signal<LiveReport | null>(null);
  liveMode = signal(true);
  loading = signal(true);
  error = signal<string | null>(null);
  lastUpdated = signal<number | null>(null);
  now = signal(Date.now());
  /** Eventos que aparecieron desde la consulta anterior (se resaltan en la lista). */
  freshKeys = signal<Set<string>>(new Set());

  secondsAgo = computed(() => {
    const t = this.lastUpdated();
    return t === null ? null : Math.max(0, Math.round((this.now() - t) / 1000));
  });

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

  /** Reparto del consumo del grupo report-kpis entre las particiones de workorders.events. */
  partitions = computed(() => {
    const p = this.live()?.consumo.particiones ?? {};
    const rows = Object.entries(p).map(([partition, v]) => ({ partition: +partition, ...v }));
    const max = Math.max(1, ...rows.map((r) => r.eventos));
    return rows.sort((a, b) => a.partition - b.partition).map((r) => ({ ...r, pct: (r.eventos / max) * 100 }));
  });

  ngOnInit(): void {
    this.load();
    this.timer = setInterval(() => {
      if (this.liveMode() && this.range() === 'last24h' && document.visibilityState === 'visible') this.load(true);
    }, LIVE_INTERVAL_MS);
    this.clock = setInterval(() => this.now.set(Date.now()), 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
    clearInterval(this.clock);
  }

  setRange(r: 'last24h' | 'last7d'): void {
    if (r === this.range()) return;
    this.range.set(r);
    this.kpis.set(null);
    this.load();
  }

  toggleLive(event: Event): void {
    this.liveMode.set((event.target as HTMLInputElement).checked);
    if (this.liveMode()) this.load(true);
  }

  load(silent = false): void {
    if (!silent) this.loading.set(true);
    this.error.set(null);
    if (this.range() === 'last24h') {
      this.api.live().subscribe({
        next: (l) => {
          const before = new Set((this.live()?.eventosRecientes ?? []).map((e) => this.key(e)));
          this.freshKeys.set(before.size
            ? new Set(l.eventosRecientes.map((e) => this.key(e)).filter((k) => !before.has(k)))
            : new Set());
          this.live.set(l);
          this.kpis.set(l.kpis);
          this.done();
        },
        error: (err) => this.fail(err),
      });
    } else {
      this.api.kpis(this.range()).subscribe({
        next: (k) => {
          this.kpis.set(k);
          this.done();
        },
        error: (err) => this.fail(err),
      });
    }
  }

  key(e: { partition: number; offset: number }): string {
    return `${e.partition}@${e.offset}`;
  }

  eventLabel(t: string): string {
    return EVENT_LABEL[t] ?? t;
  }

  label(s: string): string {
    return statusLabel(s as WorkOrderStatus);
  }

  color(s: string): string {
    return STATUS_COLOR[s as WorkOrderStatus] ?? 'var(--text-3)';
  }

  barHeight(v: number): number {
    return Math.max(2, (v / this.maxSerie()) * 100);
  }

  private done(): void {
    this.loading.set(false);
    this.lastUpdated.set(Date.now());
  }

  private fail(err: unknown): void {
    this.error.set(httpErrorMessage(err as { status?: number }));
    this.loading.set(false);
  }
}
