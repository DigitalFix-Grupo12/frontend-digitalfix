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
  /** Campos del streaming (Kafka): presentes cuando el evento llego por audit.timeline / workorders.events */
  eventId?: string | null;
  tipoEvento?: string | null;
  rolUsuario?: string | null;
  ipOrigen?: string | null;
  resultado?: 'SUCCESS' | 'DENIED' | 'ERROR' | null;
  canal?: 'KAFKA' | 'REST' | null;
  topico?: string | null;
  particion?: number | null;
  offsetKafka?: number | null;
}

/** Evento de workorders.events aplicado por report (grupo report-kpis). */
export interface LiveEvent {
  receivedAt: string;
  occurredAt: string;
  workOrderId: number;
  eventType: string;
  status: string;
  actor: string;
  role: string;
  partition: number;
  offset: number;
}

export interface SlaAlert {
  raisedAt: string;
  workOrderId: number;
  status: string;
  since: string;
  minutes: number;
}

export interface LiveReport {
  fuente: string;
  consumerGroup: string;
  kpis: Kpis;
  eventosRecientes: LiveEvent[];
  slaMinutos: number;
  ordenesEnRiesgo: { ordenId: number; estado: string; desde: string; tecnico: string }[];
  alertasRecientes: SlaAlert[];
  consumo: {
    eventosAplicados: number;
    duplicadosIgnorados: number;
    ultimoEvento: string;
    particiones: Record<string, { eventos: number; ultimoOffset: number }>;
  };
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

  /** Panel en vivo: KPIs + eventos Kafka consumidos + SLA en riesgo + consumo por particion. */
  live(): Observable<LiveReport> {
    return this.http.get<LiveReport>(`${this.base}/api/report/live`);
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
