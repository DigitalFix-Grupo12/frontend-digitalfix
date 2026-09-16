import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { WorkordersService, WorkOrder, WorkOrderStatus } from '../../core/services/workorders.service';

type SortKey = 'id' | 'descripcion' | 'clienteId' | 'status';

@Component({
  selector: 'app-workorders',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './workorders.component.html',
})
export class WorkordersComponent implements OnInit {
  private workordersService = inject(WorkordersService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  private router = inject(Router);
  authService = inject(AuthService);

  orders = signal<WorkOrder[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  statusFilter = signal<WorkOrderStatus | 'ALL'>('ALL');
  search = signal('');
  sortKey = signal<SortKey>('id');
  sortDir = signal<1 | -1>(-1);

  filteredOrders = computed(() => {
    const filter = this.statusFilter();
    const term = this.search().trim().toLowerCase();
    const key = this.sortKey();
    const dir = this.sortDir();

    let list = this.orders();
    if (filter !== 'ALL') list = list.filter((o) => o.status === filter);
    if (term) {
      list = list.filter(
        (o) =>
          o.descripcion.toLowerCase().includes(term) ||
          o.clienteId.toLowerCase().includes(term) ||
          String(o.id).includes(term)
      );
    }

    return [...list].sort((a, b) => {
      const av = a[key] ?? '';
      const bv = b[key] ?? '';
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  });

  readonly statuses: WorkOrderStatus[] = [
    'CREADA',
    'ASIGNADA',
    'EN_DESPLAZAMIENTO',
    'EN_EJECUCION',
    'CERRADA',
    'CANCELADA',
  ];

  readonly nextStatus: Record<WorkOrderStatus, WorkOrderStatus | null> = {
    CREADA: 'ASIGNADA',
    ASIGNADA: 'EN_DESPLAZAMIENTO',
    EN_DESPLAZAMIENTO: 'EN_EJECUCION',
    EN_EJECUCION: 'CERRADA',
    CERRADA: null,
    CANCELADA: null,
  };

  form = this.fb.nonNullable.group({
    descripcion: ['', Validators.required],
    clienteId: ['', Validators.required],
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.workordersService.list().subscribe({
      next: (orders) => {
        this.orders.set(orders);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(`No se pudo cargar (HTTP ${err.status}): ${err.error?.message ?? err.message}`);
        this.loading.set(false);
      },
    });
  }

  create(): void {
    if (this.form.invalid) return;
    const { descripcion, clienteId } = this.form.getRawValue();
    this.workordersService
      .create({ descripcion, clienteId, status: 'CREADA' })
      .subscribe({
        next: () => {
          this.form.reset();
          this.reload();
          this.toast.success('Orden creada correctamente.');
        },
        error: (err) => this.toast.error(`No se pudo crear (HTTP ${err.status}).`),
      });
  }

  advance(order: WorkOrder, event: Event): void {
    event.stopPropagation();
    const next = this.nextStatus[order.status];
    if (!next || !order.id) return;

    if (next === 'ASIGNADA') {
      // Requiere indicar técnico: se hace desde el detalle.
      this.router.navigate(['/workorders', order.id]);
      return;
    }

    this.workordersService.updateStatus(order.id, next).subscribe({
      next: () => {
        this.reload();
        this.toast.success(`Orden #${order.id} ahora está ${next}.`);
      },
      error: (err) => this.toast.error(`No se pudo cambiar el estado (HTTP ${err.status}).`),
    });
  }

  openDetail(order: WorkOrder): void {
    if (order.id) this.router.navigate(['/workorders', order.id]);
  }

  toggleSort(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 1 ? -1 : 1));
    } else {
      this.sortKey.set(key);
      this.sortDir.set(1);
    }
  }

  canCreate(): boolean {
    return this.authService.hasRole('Cliente', 'Supervisor', 'Admin');
  }

  canAdvance(): boolean {
    return this.authService.hasRole('Supervisor', 'Admin');
  }

  pillClass(status: WorkOrderStatus): string {
    switch (status) {
      case 'CREADA':
        return 'pill pill--open';
      case 'ASIGNADA':
      case 'EN_DESPLAZAMIENTO':
      case 'EN_EJECUCION':
        return 'pill pill--progress';
      case 'CERRADA':
        return 'pill pill--done';
      case 'CANCELADA':
        return 'pill pill--cancel';
    }
  }
}
