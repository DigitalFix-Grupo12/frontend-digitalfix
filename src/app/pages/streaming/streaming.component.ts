import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';
import {
  GroupDetail,
  GroupSummary,
  KafkaAdminService,
  KafkaCluster,
  ResetStrategy,
  TopicDetail,
  TopicSummary,
  humanMs,
} from '../../core/services/kafka-admin.service';
import { problemMessage } from '../../core/services/rabbit-admin.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { IconComponent } from '../../core/ui/icon.component';

type Tab = 'topics' | 'groups';
type Panel = 'create' | 'topic' | 'group' | null;

/** Explicacion de cada topico del sistema para la demo. */
const TOPIC_ROLE: Record<string, string> = {
  'workorders.events': 'Hechos de la orden · lo leen report-kpis y audit-timeline',
  'audit.timeline': 'Quién/qué/cuándo/desde dónde · lo publica el BFF',
};

/**
 * Administracion de Kafka (rol Admin) a traves de ms-digitalfix-kafka-admin:
 * brokers, topicos (particiones, replicas, ISR, retencion), consumer groups con lag.
 */
@Component({
  selector: 'app-streaming',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './streaming.component.html',
  host: { '(document:keydown.escape)': 'close()' },
})
export class StreamingComponent implements OnInit, OnDestroy {
  private kafka = inject(KafkaAdminService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private timer?: ReturnType<typeof setInterval>;
  private clock?: ReturnType<typeof setInterval>;

  readonly human = humanMs;

  cluster = signal<KafkaCluster | null>(null);
  topics = signal<TopicSummary[] | null>(null);
  groups = signal<GroupSummary[]>([]);
  error = signal<string | null>(null);
  tab = signal<Tab>('topics');
  showInternal = signal(false);
  autoRefresh = signal(true);
  lastUpdated = signal<number | null>(null);
  now = signal(Date.now());
  busy = signal(false);

  panel = signal<Panel>(null);
  formError = signal<string | null>(null);
  topic = signal<TopicDetail | null>(null);
  group = signal<GroupDetail | null>(null);

  // formulario: nuevo topico
  cName = signal('');
  cPartitions = signal(3);
  cReplicas = signal(3);
  cRetentionH = signal('168');
  cCleanup = signal('delete');

  // formulario: configs del topico abierto
  eRetentionH = signal('');
  eCleanup = signal('delete');
  eMinIsr = signal('2');
  ePartitions = signal(0);

  // formulario: reset de offsets
  rStrategy = signal<ResetStrategy>('EARLIEST');
  rTopic = signal('');
  rTimestamp = signal('');

  secondsAgo = computed(() => {
    const t = this.lastUpdated();
    return t === null ? null : Math.max(0, Math.round((this.now() - t) / 1000));
  });
  brokersUp = computed(() => this.cluster()?.brokers ?? 0);
  appTopics = computed(() => (this.topics() ?? []).filter((t) => !t.internal));
  totalLag = computed(() => this.groups().reduce((a, g) => a + g.totalLag, 0));
  underReplicated = computed(() => (this.topics() ?? []).reduce((a, t) => a + t.underReplicatedPartitions, 0));
  maxLag = computed(() => Math.max(1, ...(this.group()?.offsets ?? []).map((o) => o.lag)));

  ngOnInit(): void {
    this.load();
    this.timer = setInterval(() => {
      if (this.autoRefresh() && document.visibilityState === 'visible') this.load(true);
    }, 5000);
    this.clock = setInterval(() => this.now.set(Date.now()), 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
    clearInterval(this.clock);
  }

  load(silent = false): void {
    forkJoin({
      cluster: this.kafka.cluster(),
      topics: this.kafka.topics(this.showInternal()),
      groups: this.kafka.groups(),
    }).subscribe({
      next: ({ cluster, topics, groups }) => {
        this.cluster.set(cluster);
        this.topics.set(topics);
        this.groups.set(groups);
        this.error.set(null);
        this.lastUpdated.set(Date.now());
        // refresca el panel abierto (lag y offsets cambian en vivo)
        if (silent && this.panel() === 'group' && this.group()) this.refreshGroup(this.group()!.groupId);
      },
      error: (err) => {
        this.error.set(problemMessage(err).replace('RabbitMQ', 'Kafka'));
        if (this.topics() === null) this.topics.set([]);
      },
    });
  }

  toggleInternal(event: Event): void {
    this.showInternal.set((event.target as HTMLInputElement).checked);
    this.load();
  }

  role(name: string): string {
    if (TOPIC_ROLE[name]) return TOPIC_ROLE[name];
    if (name.endsWith('.DLT')) return 'Dead letter: mensajes que fallaron en el grupo ' + name.split('.').slice(-2, -1)[0];
    return '';
  }

  // ---------------------------------------------------------------- paneles

  openCreate(): void {
    this.formError.set(null);
    this.cName.set('');
    this.cPartitions.set(3);
    this.cReplicas.set(Math.min(3, this.brokersUp() || 3));
    this.cRetentionH.set('168');
    this.cCleanup.set('delete');
    this.panel.set('create');
  }

  openTopic(name: string): void {
    this.formError.set(null);
    this.topic.set(null);
    this.panel.set('topic');
    this.kafka.topic(name).subscribe({
      next: (t) => this.showTopic(t),
      error: (err) => this.formError.set(problemMessage(err)),
    });
  }

  openGroup(groupId: string): void {
    this.formError.set(null);
    this.group.set(null);
    this.panel.set('group');
    this.rStrategy.set('EARLIEST');
    this.rTopic.set('');
    this.rTimestamp.set('');
    this.refreshGroup(groupId);
  }

  close(): void {
    this.panel.set(null);
  }

  // ---------------------------------------------------------------- acciones

  createTopic(): void {
    const configs: Record<string, string> = { 'cleanup.policy': this.cCleanup() };
    const hours = Number(this.cRetentionH());
    if (this.cRetentionH().trim() && hours > 0) configs['retention.ms'] = String(Math.round(hours * 3_600_000));
    if (this.cReplicas() >= 2) configs['min.insync.replicas'] = '2';
    this.run(
      this.kafka.createTopic({
        name: this.cName().trim(),
        partitions: this.cPartitions(),
        replicationFactor: this.cReplicas(),
        configs,
      }),
      (t) => {
        this.toast.success(`Tópico ${t.name} creado: ${t.partitions} particiones × ${t.replicationFactor} réplicas`);
        this.showTopic(t);
        this.panel.set('topic');
      },
    );
  }

  saveConfigs(): void {
    const t = this.topic();
    if (!t) return;
    const set: Record<string, string> = { 'cleanup.policy': this.eCleanup(), 'min.insync.replicas': this.eMinIsr() };
    const hours = Number(this.eRetentionH());
    if (this.eRetentionH().trim()) set['retention.ms'] = hours < 0 ? '-1' : String(Math.round(hours * 3_600_000));
    this.run(this.kafka.updateConfigs(t.name, set), (r) => {
      this.toast.success(`Configuración de ${r.name} actualizada`);
      this.showTopic(r);
    });
  }

  async increasePartitions(): Promise<void> {
    const t = this.topic();
    if (!t) return;
    const ok = await this.confirm.ask({
      title: `Aumentar particiones de ${t.name}`,
      message: `Pasará de ${t.partitions} a ${this.ePartitions()} particiones. Kafka no permite reducirlas después y las claves nuevas pueden caer en otra partición.`,
      confirmLabel: 'Aumentar',
      tone: 'info',
    });
    if (!ok) return;
    this.run(this.kafka.increasePartitions(t.name, this.ePartitions()), (r) => {
      this.toast.success(r.note ?? 'Particiones aumentadas');
      this.showTopic(r);
    });
  }

  async deleteTopic(t: TopicSummary): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Eliminar tópico ${t.name}`,
      message: `Se borran sus ${t.partitions} particiones y ${t.messages} mensaje(s) retenidos. No se puede deshacer.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    this.run(this.kafka.deleteTopic(t.name), () => this.toast.success(`Tópico ${t.name} eliminado`));
  }

  async resetOffsets(): Promise<void> {
    const g = this.group();
    if (!g) return;
    const ok = await this.confirm.ask({
      title: `Mover offsets de ${g.groupId}`,
      message: this.rStrategy() === 'EARLIEST'
        ? 'El grupo volverá a procesar todos los eventos retenidos (reproceso).'
        : this.rStrategy() === 'LATEST'
          ? 'El grupo saltará los eventos pendientes (lag a 0) sin procesarlos.'
          : 'El grupo volverá a leer desde la fecha indicada.',
      confirmLabel: 'Mover offsets',
      tone: 'info',
    });
    if (!ok) return;
    const ts = this.rTimestamp() ? new Date(this.rTimestamp()).toISOString() : undefined;
    this.run(this.kafka.resetOffsets(g.groupId, this.rStrategy(), this.rTopic() || undefined, ts), (r) => {
      this.toast.success(`Offsets de ${r.groupId} movidos (${r.strategy}) en ${r.partitions.length} partición(es)`);
      this.refreshGroup(r.groupId);
    });
  }

  // ---------------------------------------------------------------- apoyo

  private showTopic(t: TopicDetail): void {
    this.topic.set(t);
    const ret = Number(this.configOf(t, 'retention.ms'));
    this.eRetentionH.set(Number.isNaN(ret) ? '' : ret < 0 ? '-1' : String(+(ret / 3_600_000).toFixed(2)));
    this.eCleanup.set(this.configOf(t, 'cleanup.policy') || 'delete');
    this.eMinIsr.set(this.configOf(t, 'min.insync.replicas') || '1');
    this.ePartitions.set(t.partitions + 1);
  }

  private configOf(t: TopicDetail, name: string): string {
    return t.configs.find((c) => c.name === name)?.value ?? '';
  }

  private refreshGroup(groupId: string): void {
    this.kafka.group(groupId).subscribe({
      next: (g) => this.group.set(g),
      error: (err) => this.formError.set(problemMessage(err)),
    });
  }

  private run<T>(obs: Observable<T>, ok: (r: T) => void): void {
    this.busy.set(true);
    this.formError.set(null);
    obs.subscribe({
      next: (r) => {
        this.busy.set(false);
        ok(r);
        this.load(true);
      },
      error: (err) => {
        this.busy.set(false);
        const msg = problemMessage(err).replace('RabbitMQ', 'Kafka');
        if (this.panel()) this.formError.set(msg);
        else this.toast.error(msg);
      },
    });
  }

  val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  num(e: Event): number {
    return Number((e.target as HTMLInputElement).value);
  }

  checked(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }
}
