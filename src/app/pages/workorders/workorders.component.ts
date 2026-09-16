import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { WorkOrder, WorkOrderStatus, WorkordersService } from '../../core/services/workorders.service';
import { IconComponent } from '../../core/ui/icon.component';
import { httpErrorMessage, timeAgo } from '../../core/ui/format';

interface Column {
  status: WorkOrderStatus;
  title: string;
  hint: string;
  icon: string;
  tone: 'blue' | 'violet' | 'amber' | 'orange' | 'green';
  /** Accion que mueve la orden a la siguiente columna (solo staff). */
  action?: { label: string; icon: string; next: WorkOrderStatus };
}

/**
 * Tablero de ordenes por etapas. Cada columna es un estado del ciclo de vida
 * y cada tarjeta tiene un unico boton con la siguiente accion posible.
 */
@Component({
  selector: 'app-workorders',
  standalone: true,
  imports: [IconComponent, RouterLink],
  templateUrl: './workorders.component.html',
})
export class WorkordersComponent implements OnInit {
  private service = inject(WorkordersService);
  private toast = inject(ToastService);
  private router = inject(Router);
  auth = inject(AuthService);

  readonly timeAgo = timeAgo;

  readonly columns: Column[] = [
    { status: 'CREADA', title: 'Nuevas', hint: 'Esperando técnico', icon: 'flag', tone: 'blue',
      action: { label: 'Asignar técnico', icon: 'userCheck', next: 'ASIGNADA' } },
    { status: 'ASIGNADA', title: 'Asignadas', hint: 'Técnico listo para salir', icon: 'userCheck', tone: 'violet',
      action: { label: 'Enviar a terreno', icon: 'truck', next: 'EN_DESPLAZAMIENTO' } },
    { status: 'EN_DESPLAZAMIENTO', title: 'En camino', hint: 'Técnico viajando al lugar', icon: 'truck', tone: 'amber',
      action: { label: 'Iniciar trabajo', icon: 'wrench', next: 'EN_EJECUCION' } },
    { status: 'EN_EJECUCION', title: 'En trabajo', hint: 'Reparación en curso', icon: 'wrench', tone: 'orange',
      action: { label: 'Cerrar orden', icon: 'check', next: 'CERRADA' } },
    { status: 'CERRADA', title: 'Terminadas', hint: 'Trabajo completado', icon: 'check', tone: 'green' },
  ];

  orders = signal<WorkOrder[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  search = signal('');
  showCancelled = signal(false);

  // formulario de creacion
  desc = signal('');
  cliente = signal('');
  saving = signal(false);

  // asignacion en linea
  assigningId = signal<number | null>(null);
  tecnico = signal('');
  busyId = signal<number | null>(null);

  isStaff = computed(() => this.auth.hasRole('Admin', 'Supervisor'));
  canCreate = computed(() => this.desc().trim().length > 0 && (!this.isStaff() || this.cliente().trim().length > 0));

  private filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.orders();
    return this.orders().filter((o) =>
      [o.descripcion, o.clienteId, o.tecnicoId ?? '', `#${o.id}`].some((v) => v.toLowerCase().includes(q))
    );
  });

  byStatus = computed(() => {
    const map: Record<string, WorkOrder[]> = {};
    for (const o of this.filtered()) (map[o.status] ??= []).push(o);
    return map;
  });

  cancelled = computed(() => this.byStatus()['CANCELADA'] ?? []);

  async ngOnInit(): Promise<void> {
    if (this.auth.getRoles().length === 0) await this.auth.refreshRoles();
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.list().subscribe({
      next: (o) => {
        this.orders.set(o);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(httpErrorMessage(err));
        this.loading.set(false);
      },
    });
  }

  create(): void {
    if (!this.canCreate() || this.saving()) return;
    this.saving.set(true);
    this.service
      .create({ descripcion: this.desc().trim(), clienteId: this.isStaff() ? this.cliente().trim() : undefined })
      .subscribe({
        next: (o) => {
          this.saving.set(false);
          this.desc.set('');
          this.cliente.set('');
          this.orders.update((list) => [o, ...list]);
          this.toast.success(`Orden #${o.id} creada. Aparece en la columna "Nuevas".`);
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.error(httpErrorMessage(err));
        },
      });
  }

  act(order: WorkOrder, col: Column): void {
    if (!col.action) return;
    if (col.action.next === 'ASIGNADA') {
      this.tecnico.set('');
      this.assigningId.set(order.id);
      return;
    }
    this.move(order, col.action.next);
  }

  confirmAssign(order: WorkOrder): void {
    const t = this.tecnico().trim();
    if (!t) {
      this.toast.error('Escribe el nombre del técnico.');
      return;
    }
    this.move(order, 'ASIGNADA', t);
  }

  cancel(order: WorkOrder): void {
    this.move(order, 'CANCELADA');
  }

  private move(order: WorkOrder, next: WorkOrderStatus, tecnicoId?: string): void {
    this.busyId.set(order.id);
    this.service.updateStatus(order.id, next, tecnicoId).subscribe({
      next: (updated) => {
        this.busyId.set(null);
        this.assigningId.set(null);
        this.orders.update((list) => list.map((o) => (o.id === updated.id ? updated : o)));
        const dest = this.columns.find((c) => c.status === next)?.title ?? 'Canceladas';
        this.toast.success(`Orden #${order.id} movida a "${dest}".`);
      },
      error: (err) => {
        this.busyId.set(null);
        this.toast.error(httpErrorMessage(err));
      },
    });
  }

  open(order: WorkOrder): void {
    void this.router.navigate(['/workorders', order.id]);
  }
}
