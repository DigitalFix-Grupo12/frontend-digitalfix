import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { WorkordersService, WorkOrder } from '../../core/services/workorders.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  authService = inject(AuthService);
  private workordersService = inject(WorkordersService);

  orders = signal<WorkOrder[] | null>(null);

  activeCount = computed(
    () => (this.orders() ?? []).filter((o) => !['CERRADA', 'CANCELADA'].includes(o.status)).length
  );
  pendingAssignCount = computed(
    () => (this.orders() ?? []).filter((o) => o.status === 'CREADA').length
  );
  closedCount = computed(
    () => (this.orders() ?? []).filter((o) => o.status === 'CERRADA').length
  );

  ngOnInit(): void {
    if (this.authService.hasRole('Admin', 'Supervisor', 'Cliente')) {
      this.workordersService.list().subscribe({
        next: (data) => this.orders.set(data),
        error: () => this.orders.set([]),
      });
    }
  }
}
