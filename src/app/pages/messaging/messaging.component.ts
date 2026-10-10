import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  BindingInfo,
  ClusterOverview,
  ExchangeInfo,
  ExchangeType,
  PeekedMessage,
  PublishResult,
  QueueInfo,
  RabbitAdminService,
  problemMessage,
} from '../../core/services/rabbit-admin.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../core/ui/icon.component';

type Panel = 'queue' | 'exchange' | 'binding' | 'publish' | null;

interface Preset {
  key: string;
  label: string;
  hint: string;
  exchange: string;
  routingKey: string;
  body: () => string;
}

const DEMO_TO = 'cliente.demo@tenatkevin.onmicrosoft.com';

function envelope(type: string, payload: object, simulateFailure?: string): string {
  const env: Record<string, unknown> = {
    type,
    eventId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    traceId: crypto.randomUUID(),
    correlationId: 'demo-panel',
    source: 'panel-admin',
    payload,
  };
  if (simulateFailure) env['simulateFailure'] = simulateFailure;
  return JSON.stringify(env, null, 2);
}

const emailPayload = (to = DEMO_TO) => ({
  orderId: 1,
  to,
  template: 'ENROUTE',
  status: 'EN_DESPLAZAMIENTO',
  tecnicoId: 'tecnico.demo',
  descripcion: 'Prueba desde el panel de mensajería',
});

/** Mensajes de prueba: cada uno demuestra una ruta del consumidor (ACK, reintento, DLQ). */
const PRESETS: Preset[] = [
  {
    key: 'email-ok', label: 'Email OK (topic)', hint: 'cmd.topic · email.enroute → q.cmd.email → ACK',
    exchange: 'cmd.topic', routingKey: 'email.enroute', body: () => envelope('EMAIL', emailPayload()),
  },
  {
    key: 'email-direct', label: 'Email OK (direct)', hint: 'cmd.direct · email.send → q.cmd.email → ACK',
    exchange: 'cmd.direct', routingKey: 'email.send', body: () => envelope('EMAIL', emailPayload()),
  },
  {
    key: 'transient-once', label: 'Falla 1 vez y se recupera', hint: '1er intento falla → reintento con x-retry-count → ACK',
    exchange: 'cmd.topic', routingKey: 'email.enroute', body: () => envelope('EMAIL', emailPayload(), 'TRANSIENT_ONCE'),
  },
  {
    key: 'transient', label: 'Falla transitoria persistente', hint: '3 intentos con espera creciente → NACK → q.cmd.email.dlq',
    exchange: 'cmd.topic', routingKey: 'email.enroute', body: () => envelope('EMAIL', emailPayload(), 'TRANSIENT'),
  },
  {
    key: 'invalid-email', label: 'Destinatario inválido', hint: 'validación del payload → NACK inmediato → DLQ',
    exchange: 'cmd.direct', routingKey: 'email.send', body: () => envelope('EMAIL', emailPayload('no-es-un-email')),
  },
  {
    key: 'bad-json', label: 'JSON mal formado', hint: 'no se puede leer → NACK inmediato → DLQ',
    exchange: 'cmd.direct', routingKey: 'email.send', body: () => '{ "type": "EMAIL", esto no es json',
  },
  {
    key: 'dispatch', label: 'Ticket de despacho', hint: 'cmd.direct · dispatch.ticket → q.cmd.dispatch',
    exchange: 'cmd.direct', routingKey: 'dispatch.ticket',
    body: () => envelope('DISPATCH_TICKET', { orderId: 99, tecnicoId: 'tecnico.demo', clienteId: DEMO_TO, descripcion: 'Revisión de tablero' }),
  },
  {
    key: 'report', label: 'Certificado PDF', hint: 'cmd.direct · report.gen → q.cmd.report → PDF',
    exchange: 'cmd.direct', routingKey: 'report.gen',
    body: () => {
      const closed = new Date();
      const created = new Date(closed.getTime() - 2.5 * 3600_000);
      return envelope('WORK_REPORT', {
        orderId: 99, clienteId: DEMO_TO, tecnicoId: 'tecnico.demo', descripcion: 'Cambio de automático',
        createdAt: created.toISOString(), closedAt: closed.toISOString(), closedBy: 'supervisor.demo',
      });
    },
  },
];

@Component({
  selector: 'app-messaging',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './messaging.component.html',
})
export class MessagingComponent implements OnInit, OnDestroy {
  private rabbit = inject(RabbitAdminService);
  private toast = inject(ToastService);
  private timer?: ReturnType<typeof setInterval>;

  readonly presets = PRESETS;
  readonly exchangeTypes: ExchangeType[] = ['direct', 'topic', 'fanout', 'headers'];

  overview = signal<ClusterOverview | null>(null);
  queues = signal<QueueInfo[] | null>(null);
  exchanges = signal<ExchangeInfo[]>([]);
  bindings = signal<BindingInfo[]>([]);
  error = signal<string | null>(null);
  autoRefresh = signal(true);
  busy = signal(false);

  panel = signal<Panel>(null);
  formError = signal<string | null>(null);

  // Formularios
  qName = signal('');
  qDurable = signal(true);
  qDlq = signal(true);
  qTtl = signal('');
  qMax = signal('');
  exName = signal('');
  exType = signal<ExchangeType>('topic');
  bExchange = signal('');
  bQueue = signal('');
  bKey = signal('');
  pExchange = signal('cmd.topic');
  pKey = signal('email.enroute');
  pBody = signal(PRESETS[0].body());
  pPreset = signal(PRESETS[0].key);
  lastPublish = signal<PublishResult | null>(null);

  // Lectura de mensajes
  peekQueue = signal<string | null>(null);
  peeked = signal<PeekedMessage[] | null>(null);

  mainQueues = computed(() => (this.queues() ?? []).filter((q) => !q.deadLetterQueue));
  dlqs = computed(() => (this.queues() ?? []).filter((q) => q.deadLetterQueue));
  dlqTotal = computed(() => this.dlqs().reduce((n, q) => n + q.messagesReady, 0));
  pendingMain = computed(() => this.mainQueues().reduce((n, q) => n + q.messagesReady, 0));
  runningNodes = computed(() => (this.overview()?.nodes ?? []).filter((n) => n.running).length);
  bindingsByQueue = computed(() => {
    const map = new Map<string, BindingInfo[]>();
    for (const b of this.bindings()) {
      if (!map.has(b.queue)) map.set(b.queue, []);
      map.get(b.queue)!.push(b);
    }
    return map;
  });

  ngOnInit(): void {
    this.load();
    this.timer = setInterval(() => this.autoRefresh() && !this.busy() && this.load(true), 5000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  load(silent = false): void {
    if (!silent) this.error.set(null);
    forkJoin({
      overview: this.rabbit.overview(),
      queues: this.rabbit.queues(),
      exchanges: this.rabbit.exchanges(),
      bindings: this.rabbit.bindings(),
    }).subscribe({
      next: (r) => {
        this.overview.set(r.overview);
        this.queues.set(r.queues);
        this.exchanges.set(r.exchanges);
        this.bindings.set(r.bindings);
        this.error.set(null);
      },
      error: (err) => {
        this.error.set(problemMessage(err));
        if (this.queues() === null) this.queues.set([]);
      },
    });
  }

  open(panel: Panel): void {
    this.formError.set(null);
    this.panel.set(panel);
    if (panel === 'binding') {
      this.bExchange.set(this.exchanges()[0]?.name ?? '');
      this.bQueue.set(this.mainQueues()[0]?.name ?? '');
    }
  }

  close(): void {
    this.panel.set(null);
  }

  // ------------------------------------------------------------- acciones

  private run<T>(obs: import('rxjs').Observable<T>, ok: (r: T) => void): void {
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
        const msg = problemMessage(err);
        if (this.panel()) this.formError.set(msg);
        else this.toast.error(msg);
      },
    });
  }

  createQueue(): void {
    const ttl = this.qTtl().trim();
    const max = this.qMax().trim();
    this.run(
      this.rabbit.createQueue({
        name: this.qName().trim(),
        durable: this.qDurable(),
        withDeadLetterQueue: this.qDlq(),
        messageTtlMs: ttl ? Number(ttl) : null,
        maxLength: max ? Number(max) : null,
      }),
      (q) => {
        this.toast.success(`Cola ${q.name} creada${this.qDlq() ? ' con su DLQ' : ''}`);
        this.qName.set('');
        this.close();
      }
    );
  }

  createExchange(): void {
    this.run(this.rabbit.createExchange({ name: this.exName().trim(), type: this.exType(), durable: true }), (e) => {
      this.toast.success(`Exchange ${e.name} (${e.type}) creado`);
      this.exName.set('');
      this.close();
    });
  }

  createBinding(): void {
    const b = { exchange: this.bExchange(), queue: this.bQueue(), routingKey: this.bKey().trim() };
    this.run(this.rabbit.createBinding(b), () => {
      this.toast.success(`Binding ${b.exchange} → ${b.queue} [${b.routingKey}] creado`);
      this.bKey.set('');
      this.close();
    });
  }

  applyPreset(key: string): void {
    const p = PRESETS.find((x) => x.key === key);
    if (!p) return;
    this.pPreset.set(key);
    this.pExchange.set(p.exchange);
    this.pKey.set(p.routingKey);
    this.pBody.set(p.body());
  }

  presetHint(): string {
    return PRESETS.find((x) => x.key === this.pPreset())?.hint ?? '';
  }

  publish(): void {
    this.run(this.rabbit.publish({ exchange: this.pExchange(), routingKey: this.pKey().trim(), body: this.pBody() }), (r) => {
      this.lastPublish.set(r);
      if (r.routed) this.toast.success(`Mensaje publicado en ${r.exchange || '(default)'} · ${r.routingKey}`);
      else this.toast.error(r.note);
      // nuevo eventId para que el siguiente envio no sea un duplicado
      this.applyPreset(this.pPreset());
    });
  }

  deleteQueue(q: QueueInfo): void {
    if (!confirm(`¿Eliminar la cola ${q.name}${q.messagesReady ? ` y sus ${q.messagesReady} mensajes` : ''}?`)) return;
    this.run(this.rabbit.deleteQueue(q.name), () => this.toast.success(`Cola ${q.name} eliminada`));
  }

  purge(q: QueueInfo): void {
    if (!confirm(`¿Vaciar ${q.name}? Se eliminan ${q.messagesReady} mensaje(s).`)) return;
    this.run(this.rabbit.purgeQueue(q.name), (r) => this.toast.success(`${r.purged} mensaje(s) eliminados de ${r.queue}`));
  }

  replay(q: QueueInfo): void {
    this.run(this.rabbit.replay(q.name, 10), (r) => {
      const dest = Object.entries(r.movedTo).map(([k, v]) => `${v} → ${k}`).join(', ');
      this.toast.success(r.moved ? `Reprocesados ${r.moved} mensaje(s): ${dest}` : 'La DLQ no tenía mensajes');
      if (this.peekQueue() === q.name) this.peek(q);
    });
  }

  deleteExchange(e: ExchangeInfo): void {
    if (!confirm(`¿Eliminar el exchange ${e.name}?`)) return;
    this.run(this.rabbit.deleteExchange(e.name), () => this.toast.success(`Exchange ${e.name} eliminado`));
  }

  deleteBinding(b: BindingInfo): void {
    if (!confirm(`¿Eliminar el binding ${b.exchange} → ${b.queue} [${b.routingKey}]?`)) return;
    this.run(this.rabbit.deleteBinding(b), () => this.toast.success('Binding eliminado'));
  }

  peek(q: QueueInfo): void {
    this.peekQueue.set(q.name);
    this.peeked.set(null);
    this.rabbit.peek(q.name, 10).subscribe({
      next: (m) => this.peeked.set(m),
      error: (err) => {
        this.peeked.set([]);
        this.toast.error(problemMessage(err));
      },
    });
  }

  closePeek(): void {
    this.peekQueue.set(null);
    this.peeked.set(null);
  }

  pretty(payload: string): string {
    try {
      return JSON.stringify(JSON.parse(payload), null, 2);
    } catch {
      return payload;
    }
  }

  shortNode(node: string | null | undefined): string {
    return node ? node.replace(/^rabbit@/, '') : '—';
  }

  uptime(min: number): string {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    return h < 48 ? `${h} h ${min % 60} min` : `${Math.floor(h / 24)} días`;
  }

  val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  checked(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }
}
