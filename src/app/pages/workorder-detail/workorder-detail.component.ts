import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { WorkordersService, WorkOrder, WorkOrderStatus } from '../../core/services/workorders.service';

@Component({
  selector: 'app-workorder-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './workorder-detail.component.html',
})
export class WorkorderDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private workordersService = inject(WorkordersService);
  private toast = inject(ToastService);
  authService = inject(AuthService);

  order = signal<WorkOrder | null>(null);
  loading = signal(true);
  notFound = signal(false);
  tecnicoId = signal('');

  readonly nextStatus: Record<WorkOrderStatus, WorkOrderStatus | null> = {
    CREADA: 'ASIGNADA',
    ASIGNADA: 'EN_DESPLAZAMIENTO',
    EN_DESPLAZAMIENTO: 'EN_EJECUCION',
    EN_EJECUCION: 'CERRADA',
    CERRADA: null,
    CANCELADA: null,
  };

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }
    this.workordersService.getById(id).subscribe({
      next: (o) => {
        this.order.set(o);
        this.loading.set(false);
      },
      error: () => {
        this.notFound.set(true);
        this.loading.set(false);
      },
    });
  }

  canAdvance(): boolean {
    return this.authService.hasRole('Supervisor', 'Admin');
  }

  needsTechnician(): boolean {
    return this.order()?.status === 'CREADA';
  }

  advance(): void {
    const order = this.order();
    if (!order?.id) return;
    const next = this.nextStatus[order.status];
    if (!next) return;

    if (this.needsTechnician() && !this.tecnicoId().trim()) {
      this.toast.error('Indica el ID o nombre del técnico antes de asignar.');
      return;
    }

    this.workordersService.updateStatus(order.id, next, this.tecnicoId().trim() || undefined).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.toast.success(`Orden #${order.id} ahora está ${next}.`);
      },
      error: (err) => this.toast.error(`No se pudo cambiar el estado (HTTP ${err.status}).`),
    });
  }

  back(): void {
    this.router.navigate(['/workorders']);
  }
}
