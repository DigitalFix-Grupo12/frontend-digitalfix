import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { KafkaAdminService, humanMs } from './kafka-admin.service';
import { appConfig } from '../config/app-config';

describe('KafkaAdminService', () => {
  let service: KafkaAdminService;
  let http: HttpTestingController;
  const base = `${appConfig.api.baseUrl}/api/kafka`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(KafkaAdminService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista los tópicos a través del API Gateway', () => {
    service.topics().subscribe();
    const req = http.expectOne((r) => r.url === `${base}/topics`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('includeInternal')).toBe('false');
    req.flush([]);
  });

  it('crea un tópico con particiones, réplicas y configuración', () => {
    service.createTopic({ name: 'analytics.orders', partitions: 3, replicationFactor: 3, configs: { 'retention.ms': '3600000' } })
      .subscribe();
    const req = http.expectOne(`${base}/topics`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.replicationFactor).toBe(3);
    expect(req.request.body.configs['retention.ms']).toBe('3600000');
    req.flush({});
  });

  it('cambia la configuración con PATCH', () => {
    service.updateConfigs('workorders.events', { 'retention.ms': '259200000' }).subscribe();
    const req = http.expectOne(`${base}/topics/workorders.events/configs`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body.set['retention.ms']).toBe('259200000');
    req.flush({});
  });

  it('mueve los offsets de un consumer group', () => {
    service.resetOffsets('report-kpis', 'EARLIEST', 'workorders.events').subscribe();
    const req = http.expectOne(`${base}/consumer-groups/report-kpis/reset-offsets`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ strategy: 'EARLIEST', topic: 'workorders.events', timestamp: null });
    req.flush({});
  });
});

describe('humanMs', () => {
  it('convierte la retención a texto legible', () => {
    expect(humanMs('604800000')).toBe('7 d');
    expect(humanMs(7_200_000)).toBe('2 h');
    expect(humanMs(-1)).toBe('sin límite');
    expect(humanMs(null)).toBe('—');
  });
});
