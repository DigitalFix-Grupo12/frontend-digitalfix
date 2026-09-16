import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, AuditEvent } from '../../core/services/api.service';
import { IconComponent } from '../../core/ui/icon.component';
import { formatDateTime, httpErrorMessage, timeAgo } from '../../core/ui/format';

type Kind = 'ALL' | 'CREATE' | 'ASSIGN' | 'CHANGE' | 'CLOSE' | 'CANCEL';

function kindOf(accion: string): Exclude<Kind, 'ALL'> {
  if (accion.startsWith('CREO')) return 'CREATE';
  if (accion.startsWith('ASIGNO')) return 'ASSIGN';
  if (accion.includes('-> CERRADA')) return 'CLOSE';
  if (accion.includes('-> CANCELADA')) return 'CANCEL';
  return 'CHANGE';
}

const KIND_UI: Record<Exclude<Kind, 'ALL'>, { icon: string; tone: string; label: string }> = {
  CREATE: { icon: 'plus', tone: 'blue', label: 'Creación' },
  ASSIGN: { icon: 'userCheck', tone: 'amber', label: 'Asignación' },
  CHANGE: { icon: 'refresh', tone: 'amber', label: 'Cambio de estado' },
  CLOSE: { icon: 'check', tone: 'green', label: 'Cierre' },
  CANCEL: { icon: 'ban', tone: 'gray', label: 'Cancelación' },
};

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [IconComponent, RouterLink],
  templateUrl: './audit.component.html',
})
export class AuditComponent implements OnInit {
  private api = inject(ApiService);
  readonly ui = KIND_UI;
  readonly kindOf = kindOf;
  readonly timeAgo = timeAgo;
  readonly fmt = formatDateTime;

  events = signal<AuditEvent[] | null>(null);
  error = signal<string | null>(null);
  search = signal('');
  kind = signal<Kind>('ALL');
  user = signal('');

  readonly kinds: { key: Kind; label: string }[] = [
    { key: 'ALL', label: 'Todos' },
    { key: 'CREATE', label: 'Creaciones' },
    { key: 'ASSIGN', label: 'Asignaciones' },
    { key: 'CHANGE', label: 'Cambios' },
    { key: 'CLOSE', label: 'Cierres' },
    { key: 'CANCEL', label: 'Cancelaciones' },
  ];

  users = computed(() => [...new Set((this.events() ?? []).map((e) => e.usuario))].sort());
  lastEvent = computed(() => (this.events() ?? [])[0] ?? null);

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const k = this.kind();
    const u = this.user();
    return (this.events() ?? []).filter(
      (e) =>
        (k === 'ALL' || kindOf(e.accion) === k) &&
        (!u || e.usuario === u) &&
        (!q || `${e.accion} ${e.usuario} ${e.referencia ?? ''}`.toLowerCase().includes(q))
    );
  });

  groups = computed(() => {
    const map = new Map<string, AuditEvent[]>();
    for (const e of this.filtered()) {
      const day = new Date(e.fecha).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(e);
    }
    return [...map.entries()].map(([day, items]) => ({ day, items }));
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.events.set(null);
    this.error.set(null);
    this.api.audit({ limit: 500 }).subscribe({
      next: (e) => this.events.set(e),
      error: (err) => {
        this.error.set(httpErrorMessage(err));
        this.events.set([]);
      },
    });
  }

  orderId(ref?: string): number | null {
    const m = ref?.match(/^orden#(\d+)$/);
    return m ? Number(m[1]) : null;
  }

  exportCsv(): void {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [
      ['id', 'fecha', 'usuario', 'accion', 'servicio', 'referencia'].join(','),
      ...this.filtered().map((e) =>
        [e.id, e.fecha, e.usuario, e.accion, e.servicio, e.referencia ?? ''].map((v) => esc(String(v))).join(',')
      ),
    ];
    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `auditoria-digitalfix-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
