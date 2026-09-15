import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { WorkordersService, WorkOrder, WorkOrderStatus } from '../../core/services/workorders.service';

@Component({
  selector: 'app-workorders',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './workorders.component.html',
})
export class WorkordersComponent implements OnInit {
  private workordersService = inject(WorkordersService);
  private fb = inject(FormBuilder);
  authService = inject(AuthService);

  orders = signal<WorkOrder[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

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
        },
        error: (err) => this.error.set(`No se pudo crear (HTTP ${err.status})`),
      });
  }

  advance(order: WorkOrder): void {
    const next = this.nextStatus[order.status];
    if (!next || !order.id) return;
    this.workordersService.updateStatus(order.id, next).subscribe({
      next: () => this.reload(),
      error: (err) => this.error.set(`No se pudo cambiar el estado (HTTP ${err.status})`),
    });
  }

  canCreate(): boolean {
    return this.authService.hasRole('Cliente', 'Supervisor', 'Admin');
  }

  canAdvance(): boolean {
    return this.authService.hasRole('Supervisor', 'Admin');
  }
}
