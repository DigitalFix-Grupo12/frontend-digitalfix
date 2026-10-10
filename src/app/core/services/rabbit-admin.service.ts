import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { appConfig } from '../config/app-config';

export interface RabbitNode {
  name: string;
  running: boolean;
  memUsedMb: number;
  uptimeMinutes: number;
}

export interface ClusterOverview {
  clusterName: string;
  rabbitmqVersion: string;
  nodes: RabbitNode[];
  queues: number;
  exchanges: number;
  connections: number;
  consumers: number;
  messagesReady: number;
  messagesUnacked: number;
}

export interface QueueInfo {
  name: string;
  durable: boolean;
  autoDelete: boolean;
  type: string;
  node: string;
  messagesReady: number;
  messagesUnacked: number;
  consumers: number;
  deadLetterExchange: string | null;
  deadLetterRoutingKey: string | null;
  messageTtlMs: number | null;
  maxLength: number | null;
  isProtected: boolean;
  deadLetterQueue: boolean;
}

export type ExchangeType = 'direct' | 'topic' | 'fanout' | 'headers';

export interface ExchangeInfo {
  name: string;
  type: ExchangeType;
  durable: boolean;
  internal: boolean;
  isProtected: boolean;
}

export interface BindingInfo {
  exchange: string;
  queue: string;
  routingKey: string;
}

export interface PeekedMessage {
  messageId: string | null;
  exchange: string;
  routingKey: string;
  redelivered: boolean;
  originalQueue: string | null;
  deathReason: string | null;
  retryCount: number | null;
  lastError: string | null;
  headers: Record<string, unknown>;
  payload: string;
}

export interface PublishResult {
  messageId: string;
  exchange: string;
  routingKey: string;
  routed: boolean;
  note: string;
}

export interface ReplayResult {
  deadLetterQueue: string;
  moved: number;
  movedTo: Record<string, number>;
  skipped: number;
}

export interface CreateQueue {
  name: string;
  durable: boolean;
  withDeadLetterQueue: boolean;
  messageTtlMs?: number | null;
  maxLength?: number | null;
}

export interface CreateExchange {
  name: string;
  type: ExchangeType;
  durable: boolean;
}

export interface PublishMessage {
  exchange: string;
  routingKey: string;
  body: string;
}

/** Administracion de RabbitMQ (rol Admin) via API Gateway -> BFF -> ms-digitalfix-rabbit-admin. */
@Injectable({ providedIn: 'root' })
export class RabbitAdminService {
  private http = inject(HttpClient);
  private base = `${appConfig.api.baseUrl}/api/rabbit`;

  overview(): Observable<ClusterOverview> {
    return this.http.get<ClusterOverview>(`${this.base}/overview`);
  }

  queues(): Observable<QueueInfo[]> {
    return this.http.get<QueueInfo[]>(`${this.base}/queues`);
  }

  createQueue(req: CreateQueue): Observable<QueueInfo> {
    return this.http.post<QueueInfo>(`${this.base}/queues`, req);
  }

  deleteQueue(name: string, ifEmpty = false): Observable<void> {
    const params = new HttpParams().set('ifEmpty', ifEmpty);
    return this.http.delete<void>(`${this.base}/queues/${encodeURIComponent(name)}`, { params });
  }

  purgeQueue(name: string): Observable<{ queue: string; purged: number }> {
    return this.http.delete<{ queue: string; purged: number }>(`${this.base}/queues/${encodeURIComponent(name)}/messages`);
  }

  peek(name: string, count = 10): Observable<PeekedMessage[]> {
    return this.http.get<PeekedMessage[]>(`${this.base}/queues/${encodeURIComponent(name)}/messages`, {
      params: { count },
    });
  }

  replay(dlq: string, max = 10): Observable<ReplayResult> {
    return this.http.post<ReplayResult>(`${this.base}/queues/${encodeURIComponent(dlq)}/replay`, null, {
      params: { max },
    });
  }

  exchanges(): Observable<ExchangeInfo[]> {
    return this.http.get<ExchangeInfo[]>(`${this.base}/exchanges`);
  }

  createExchange(req: CreateExchange): Observable<ExchangeInfo> {
    return this.http.post<ExchangeInfo>(`${this.base}/exchanges`, req);
  }

  deleteExchange(name: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/exchanges/${encodeURIComponent(name)}`);
  }

  bindings(): Observable<BindingInfo[]> {
    return this.http.get<BindingInfo[]>(`${this.base}/bindings`);
  }

  createBinding(b: BindingInfo): Observable<BindingInfo> {
    return this.http.post<BindingInfo>(`${this.base}/bindings`, b);
  }

  deleteBinding(b: BindingInfo): Observable<void> {
    const params = new HttpParams().set('exchange', b.exchange).set('queue', b.queue).set('routingKey', b.routingKey);
    return this.http.delete<void>(`${this.base}/bindings`, { params });
  }

  publish(msg: PublishMessage): Observable<PublishResult> {
    return this.http.post<PublishResult>(`${this.base}/messages`, msg);
  }
}

/**
 * Mensaje legible desde una respuesta de error del administrador (RFC 7807):
 * usa "detail" y agrega los errores por campo de la validacion.
 */
export function problemMessage(err: { status?: number; error?: unknown }): string {
  const body = err.error as { detail?: string; message?: string; errors?: Record<string, string> } | null;
  if (err.status === 0) return 'No hay conexión con el API Gateway.';
  if (err.status === 401) return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  if (err.status === 403) return 'Solo el rol Admin puede administrar RabbitMQ.';
  if (body && typeof body === 'object') {
    const fields = body.errors ? Object.entries(body.errors).map(([k, v]) => `${k}: ${v}`).join(' · ') : '';
    const base = body.detail ?? body.message ?? '';
    if (fields) return fields;
    if (base) return base;
  }
  return `Error inesperado (HTTP ${err.status}).`;
}
