import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { WorkOrder, WorkOrderStatus, WorkordersService } from '../../core/services/workorders.service';
import { IconComponent } from '../../core/ui/icon.component';
import { FLOW, NEXT_STATUS, STATUS_META, badgeClass, httpErrorMessage, statusLabel, timeAgo } from '../../core/ui/format';

type SortKey = 'id' | 'descripcion' | 'clienteId' | 'status' | 'createdAt';
type Filter = WorkOrderStatus | 'ALL' | 'ACTIVE';

@Component({
  selector: 'app-workorders',
  standalone: true,
  imports: [ReactiveFormsModule, IconComponent],
  templateUrl: './workorders.component.html',
})
export class WorkordersComponent implements OnInit {
  private service = inject(WorkordersService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  auth = inject(AuthService);

  readonly badgeClass = badgeClass;
  readonly statusLabel = statusLabel;
  readonly timeAgo = timeAgo;
  readonly nextStatus = NEXT_STATUS;
  readonly flow = FLOW;

  orders = signal<WorkOrder[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  filter = signal<Filter>('ACTIVE');
  search = signal('');
  sortKey = signal<SortKey>('id');
  sortDir = signal<1 | -1>(-1);
  drawerOpen = signal(false);
  saving = signal(false);
  busyId = signal<number | null>(null);

  isStaff = computed(() => this.auth.hasRole('Admin', 'Supervisor'));

  readonly filters: { key: Filter; label: string }[] = [
    { key: 'ACTIVE', label: 'Activas' },
    { key: 'CREADA', label: 'Por asignar' },
    { key: 'ASIGNADA', label: 'Asignadas' },
    { key: 'EN_DESPLAZAMIENTO', label: 'En ruta' },
    { key: 'EN_EJECUCION', label: 'En ejecución' },
    { key: 'CERRADA', label: 'Cerradas' },
    { key: 'CANCELADA', label: 'Canceladas' },
    { key: 'ALL', label: 'Todas' },
  ];

  counts = computed(() => {
    const list = this.orders();
    const c: Record<string, number> = { ALL: list.length, ACTIVE: 0 };
    for (const o of list) {
      c[o.status] = (c[o.status] ?? 0) + 1;
      if (o.status !== 'CERRADA' && o.status !== 'CANCELADA') c['ACTIVE']++;
    }
    return c;
  });

  visible = computed(() => {
    const f = this.filter();
    const term = this.search().trim().toLowerCase();
    const key = this.sortKey();
    const dir = this.sortDir();

    let list = this.orders();
    if (f === 'ACTIVE') list = list.filter((o) => o.status !== 'CERRADA' && o.status !== 'CANCELADA');
    else if (f !== 'ALL') list = list.filter((o) => o.status === f);
    if (term) {
      list = list.filter((o) =>
        [o.descripcion, o.clienteId, o.tecnicoId ?? '', `#${o.id}`, statusLabel(o.status)]
          .some((v) => v.toLowerCase().includes(term))
      );
    }
    return [...list].sort((a, b) => {
      const av = (a[key] ?? '') as string | number;
      const bv = (b[key] ?? '') as string | number;
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  });

  form = this.fb.nonNullable.group({
    descripcion: ['', [Validators.required, Validators.maxLength(500)]],
    clienteId: [''],
  });

  async ngOnInit(): Promise<void> {
    if (this.auth.getRoles().length === 0) await this.auth.refreshRoles();
    if (this.isStaff()) this.form.controls.clienteId.addValidators(Validators.required);
    if (this.route.snapshot.queryParamMap.get('nueva')) this.openDrawer();
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

  openDrawer(): void {
    this.form.reset();
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    if (this.route.snapshot.queryParamMap.get('nueva')) {
      void this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  create(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const { descripcion, clienteId } = this.form.getRawValue();
    this.service
      .create({ descripcion: descripcion.trim(), clienteId: this.isStaff() ? clienteId.trim() : undefined })
      .subscribe({
        next: (o) => {
          this.saving.set(false);
          this.closeDrawer();
          this.filter.set('ACTIVE');
          this.orders.update((list) => [o, ...list]);
          this.toast.success(`Orden #${o.id} creada.`);
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.error(httpErrorMessage(err));
        },
      });
  }

  advance(order: WorkOrder, event: Event): void {
    event.stopPropagation();
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    if (next === 'ASIGNADA') {
      void this.router.navigate(['/workorders', order.id]);
      return;
    }
    this.busyId.set(order.id);
    this.service.updateStatus(order.id, next).subscribe({
      next: (updated) => {
        this.busyId.set(null);
        this.orders.update((list) => list.map((o) => (o.id === updated.id ? updated : o)));
        this.toast.success(`Orden #${order.id}: ${statusLabel(next)}.`);
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

  sort(key: SortKey): void {
    if (this.sortKey() === key) this.sortDir.update((d) => (d === 1 ? -1 : 1));
    else {
      this.sortKey.set(key);
      this.sortDir.set(1);
    }
  }

  arrow(key: SortKey): string {
    return this.sortKey() === key ? (this.sortDir() === 1 ? '↑' : '↓') : '';
  }

  step(o: WorkOrder): number {
    return STATUS_META[o.status].step;
  }

  actionLabel(o: WorkOrder): string {
    const next = NEXT_STATUS[o.status];
    return next === 'ASIGNADA' ? 'Asignar' : next ? statusLabel(next) : '';
  }
}
