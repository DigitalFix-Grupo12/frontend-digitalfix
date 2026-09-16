import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { appConfig } from '../config/app-config';

export type WorkOrderStatus =
  | 'CREADA'
  | 'ASIGNADA'
  | 'EN_DESPLAZAMIENTO'
  | 'EN_EJECUCION'
  | 'CERRADA'
  | 'CANCELADA';

export interface WorkOrder {
  id: number;
  descripcion: string;
  clienteId: string;
  tecnicoId?: string | null;
  status: WorkOrderStatus;
  createdAt?: string;
  updatedAt?: string;
  closedAt?: string | null;
}

export interface NewWorkOrder {
  descripcion: string;
  /** Obligatorio para Admin/Supervisor; para el rol Cliente lo fija el backend. */
  clienteId?: string;
}

/**
 * Todas las llamadas van al API Gateway. El MsalInterceptor adjunta el Bearer
 * token automaticamente porque la URL coincide con protectedResourceMap.
 */
@Injectable({ providedIn: 'root' })
export class WorkordersService {
  private http = inject(HttpClient);
  private baseUrl = `${appConfig.api.baseUrl}/api/workorders`;

  list(status?: WorkOrderStatus): Observable<WorkOrder[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<WorkOrder[]>(this.baseUrl, { params });
  }

  getById(id: number): Observable<WorkOrder> {
    return this.http.get<WorkOrder>(`${this.baseUrl}/${id}`);
  }

  create(order: NewWorkOrder): Observable<WorkOrder> {
    return this.http.post<WorkOrder>(this.baseUrl, order);
  }

  updateStatus(id: number, status: WorkOrderStatus, tecnicoId?: string): Observable<WorkOrder> {
    return this.http.put<WorkOrder>(`${this.baseUrl}/${id}/status`, { status, tecnicoId });
  }
}
