import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { appConfig } from '../config/app-config';

export interface BrokerView {
  id: number;
  host: string;
  port: number;
  rack: string | null;
  controller: boolean;
}

export interface KafkaCluster {
  clusterId: string;
  controllerId: number;
  brokers: number;
  nodes: BrokerView[];
}

export interface TopicSummary {
  name: string;
  partitions: number;
  replicationFactor: number;
  internal: boolean;
  protectedTopic: boolean;
  underReplicatedPartitions: number;
  messages: number;
}

export interface PartitionView {
  partition: number;
  leader: number;
  replicas: number[];
  isr: number[];
  beginningOffset: number;
  endOffset: number;
  messages: number;
}

export interface ConfigView {
  name: string;
  value: string;
  source: string;
  isDefault: boolean;
}

export interface TopicDetail {
  name: string;
  partitions: number;
  replicationFactor: number;
  protectedTopic: boolean;
  partitionDetails: PartitionView[];
  configs: ConfigView[];
  note: string | null;
}

export interface GroupSummary {
  groupId: string;
  state: string;
  members: number;
  coordinator: number;
  topics: string[];
  totalLag: number;
}

export interface MemberView {
  memberId: string;
  clientId: string;
  host: string;
  assignments: string[];
}

export interface OffsetView {
  topic: string;
  partition: number;
  committedOffset: number;
  endOffset: number;
  lag: number;
  consumer: string;
}

export interface GroupDetail {
  groupId: string;
  state: string;
  assignor: string;
  coordinator: number;
  members: MemberView[];
  offsets: OffsetView[];
  totalLag: number;
}

export interface CreateTopic {
  name: string;
  partitions: number;
  replicationFactor: number;
  configs: Record<string, string>;
}

export type ResetStrategy = 'EARLIEST' | 'LATEST' | 'TIMESTAMP';

export interface ResetResult {
  groupId: string;
  strategy: ResetStrategy;
  partitions: { topic: string; partition: number; before: number; after: number }[];
}

/** Administracion de Kafka (rol Admin) via API Gateway -> BFF -> ms-digitalfix-kafka-admin. */
@Injectable({ providedIn: 'root' })
export class KafkaAdminService {
  private http = inject(HttpClient);
  private base = `${appConfig.api.baseUrl}/api/kafka`;

  cluster(): Observable<KafkaCluster> {
    return this.http.get<KafkaCluster>(`${this.base}/cluster`);
  }

  topics(includeInternal = false): Observable<TopicSummary[]> {
    return this.http.get<TopicSummary[]>(`${this.base}/topics`, { params: new HttpParams().set('includeInternal', includeInternal) });
  }

  topic(name: string): Observable<TopicDetail> {
    return this.http.get<TopicDetail>(`${this.base}/topics/${encodeURIComponent(name)}`);
  }

  createTopic(req: CreateTopic): Observable<TopicDetail> {
    return this.http.post<TopicDetail>(`${this.base}/topics`, req);
  }

  updateConfigs(name: string, set: Record<string, string>, remove: string[] = []): Observable<TopicDetail> {
    return this.http.patch<TopicDetail>(`${this.base}/topics/${encodeURIComponent(name)}/configs`, { set, delete: remove });
  }

  increasePartitions(name: string, totalPartitions: number): Observable<TopicDetail> {
    return this.http.post<TopicDetail>(`${this.base}/topics/${encodeURIComponent(name)}/partitions`, { totalPartitions });
  }

  deleteTopic(name: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/topics/${encodeURIComponent(name)}`);
  }

  groups(): Observable<GroupSummary[]> {
    return this.http.get<GroupSummary[]>(`${this.base}/consumer-groups`);
  }

  group(groupId: string): Observable<GroupDetail> {
    return this.http.get<GroupDetail>(`${this.base}/consumer-groups/${encodeURIComponent(groupId)}`);
  }

  resetOffsets(groupId: string, strategy: ResetStrategy, topic?: string, timestamp?: string): Observable<ResetResult> {
    return this.http.post<ResetResult>(`${this.base}/consumer-groups/${encodeURIComponent(groupId)}/reset-offsets`, {
      strategy,
      topic: topic || null,
      timestamp: timestamp || null,
    });
  }
}

/** Convierte milisegundos de retencion a texto legible (7 d, 12 h, 30 min). */
export function humanMs(ms: string | number | null | undefined): string {
  const n = Number(ms);
  if (ms === null || ms === undefined || Number.isNaN(n)) return '—';
  if (n < 0) return 'sin límite';
  const d = n / 86_400_000;
  if (d >= 1 && Number.isInteger(Math.round(d * 10) / 10)) return `${+d.toFixed(1)} d`;
  const h = n / 3_600_000;
  if (h >= 1) return `${+h.toFixed(1)} h`;
  return `${Math.round(n / 60_000)} min`;
}
