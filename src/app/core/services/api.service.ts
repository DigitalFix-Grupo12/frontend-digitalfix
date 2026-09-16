import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { appConfig } from '../config/app-config';

export interface CatalogItem {
  id: number;
  nombre: string;
  tipo: 'SERVICIO' | 'REPUESTO';
  stock: number;
  tarifa: number;
}

export interface SeriePoint {
  label: string;
  ordenes: number;
}

export interface Kpis {
  range: string;
  generadoEn: string;
  totalOrdenes: number;
  ordenesEnRango: number;
  ordenesPorHora: number;
  tiempoResolucionPromedioMin: number;
  estadosActivos: number;
  porEstado: Record<string, number>;
  serie: SeriePoint[];
}

export interface AuditEvent {
  id: number;
  usuario: string;
  accion: string;
  servicio: string;
  referencia?: string;
  fecha: string;
}

/** Endpoints de catalogo, reportes y auditoria (via API Gateway). */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = appConfig.api.baseUrl;

  /** Estado del backend: la ruta /actuator/health del Gateway es publica. */
  readonly backendOnline = signal<boolean | null>(null);

  catalog(tipo?: string): Observable<CatalogItem[]> {
    let params = new HttpParams();
    if (tipo) params = params.set('tipo', tipo);
    return this.http.get<CatalogItem[]>(`${this.base}/api/catalog/services`, { params });
  }

  kpis(range: 'last24h' | 'last7d'): Observable<Kpis> {
    return this.http.get<Kpis>(`${this.base}/api/report/kpis`, { params: { range } });
  }

  audit(opts: { limit?: number; referencia?: string } = {}): Observable<AuditEvent[]> {
    let params = new HttpParams().set('limit', opts.limit ?? 100);
    if (opts.referencia) params = params.set('referencia', opts.referencia);
    return this.http.get<AuditEvent[]>(`${this.base}/api/audit`, { params });
  }

  /** fetch directo (sin MsalInterceptor): no necesita token. */
  async checkHealth(): Promise<void> {
    try {
      const res = await fetch(`${this.base}/actuator/health`, { cache: 'no-store' });
      this.backendOnline.set(res.ok);
    } catch {
      this.backendOnline.set(false);
    }
  }
}
