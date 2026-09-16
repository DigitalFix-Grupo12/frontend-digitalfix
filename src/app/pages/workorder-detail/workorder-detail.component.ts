import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ApiService, AuditEvent } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { WorkOrder, WorkOrderStatus, WorkordersService } from '../../core/services/workorders.service';
import { IconComponent } from '../../core/ui/icon.component';
import {
  CANCELLABLE, FLOW, NEXT_STATUS, STATUS_META, badgeClass, formatDateTime, httpErrorMessage, statusLabel, timeAgo,
} from '../../core/ui/format';

@Component({
  selector: 'app-workorder-detail',
  standalone: true,
  imports: [RouterLink, IconComponent],
  templateUrl: './workorder-detail.component.html',
})
export class WorkorderDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private service = inject(WorkordersService);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  auth = inject(AuthService);

  readonly flow = FLOW;
  readonly meta = STATUS_META;
  readonly badgeClass = badgeClass;
  readonly statusLabel = statusLabel;
  readonly fmt = formatDateTime;
  readonly timeAgo = timeAgo;

  order = signal<WorkOrder | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  tecnico = signal('');
  busy = signal(false);
  confirmCancel = signal(false);
  history = signal<AuditEvent[] | null>(null);

  isStaff = computed(() => this.auth.hasRole('Admin', 'Supervisor'));
  canSeeHistory = computed(() => this.auth.hasRole('Admin', 'Auditor'));
  next = computed(() => {
    const o = this.order();
    return o ? NEXT_STATUS[o.status] : null;
  });
  currentStep = computed(() => {
    const o = this.order();
    return o ? STATUS_META[o.status].step : 0;
  });
  cancellable = computed(() => {
    const o = this.order();
    return !!o && CANCELLABLE.includes(o.status);
  });

  async ngOnInit(): Promise<void> {
    if (this.auth.getRoles().length === 0) await this.auth.refreshRoles();
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.error.set('Identificador de orden inválido.');
      this.loading.set(false);
      return;
    }
    this.service.getById(id).subscribe({
      next: (o) => {
        this.order.set(o);
        this.loading.set(false);
        this.loadHistory();
      },
      error: (err) => {
        this.error.set(err.status === 404 ? 'La orden no existe o no tienes acceso a ella.' : httpErrorMessage(err));
        this.loading.set(false);
      },
    });
  }

  loadHistory(): void {
    const o = this.order();
    if (!o || !this.canSeeHistory()) return;
    this.api.audit({ referencia: `orden#${o.id}`, limit: 50 }).subscribe({
      next: (h) => this.history.set(h),
      error: () => this.history.set([]),
    });
  }

  stepState(i: number): 'done' | 'current' | '' {
    const o = this.order();
    if (!o || o.status === 'CANCELADA') return '';
    const cur = this.currentStep();
    if (o.status === 'CERRADA') return 'done';
    return i < cur ? 'done' : i === cur ? 'current' : '';
  }

  advance(): void {
    const next = this.next();
    if (!next) return;
    if (next === 'ASIGNADA' && !this.tecnico().trim()) {
      this.toast.error('Indica el técnico que atenderá la orden.');
      return;
    }
    this.change(next, next === 'ASIGNADA' ? this.tecnico().trim() : undefined);
  }

  cancel(): void {
    this.confirmCancel.set(false);
    this.change('CANCELADA');
  }

  private change(status: WorkOrderStatus, tecnicoId?: string): void {
    const o = this.order();
    if (!o) return;
    this.busy.set(true);
    this.service.updateStatus(o.id, status, tecnicoId).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.busy.set(false);
        this.tecnico.set('');
        this.toast.success(`Orden #${o.id}: ${statusLabel(status)}.`);
        this.loadHistory();
      },
      error: (err) => {
        this.busy.set(false);
        this.toast.error(httpErrorMessage(err));
      },
    });
  }

  historyTone(accion: string): string {
    if (accion.includes('CERRADA')) return 'green';
    if (accion.includes('CANCELADA')) return 'gray';
    if (accion.startsWith('CREO')) return 'blue';
    return 'amber';
  }

  historyIcon(accion: string): string {
    if (accion.startsWith('CREO')) return 'plus';
    if (accion.startsWith('ASIGNO')) return 'userCheck';
    if (accion.includes('CERRADA')) return 'check';
    if (accion.includes('CANCELADA')) return 'ban';
    if (accion.includes('EN_DESPLAZAMIENTO')) return 'truck';
    return 'wrench';
  }
}
