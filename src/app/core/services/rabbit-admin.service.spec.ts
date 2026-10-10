import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RabbitAdminService, problemMessage } from './rabbit-admin.service';
import { appConfig } from '../config/app-config';

describe('RabbitAdminService', () => {
  let service: RabbitAdminService;
  let http: HttpTestingController;
  const base = `${appConfig.api.baseUrl}/api/rabbit`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(RabbitAdminService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista las colas a través del API Gateway', () => {
    service.queues().subscribe();
    const req = http.expectOne(`${base}/queues`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('crea una cola con DLQ', () => {
    service.createQueue({ name: 'q.demo', durable: true, withDeadLetterQueue: true }).subscribe();
    const req = http.expectOne(`${base}/queues`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.withDeadLetterQueue).toBe(true);
    req.flush({});
  });

  it('elimina un binding identificado por exchange, cola y routing key', () => {
    service.deleteBinding({ exchange: 'cmd.topic', queue: 'q.demo', routingKey: 'demo.#' }).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/bindings`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.params.get('routingKey')).toBe('demo.#');
    req.flush(null);
  });

  it('codifica el nombre de la cola en la URL', () => {
    service.peek('q.cmd.email.dlq', 5).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/queues/q.cmd.email.dlq/messages`);
    expect(req.request.params.get('count')).toBe('5');
    req.flush([]);
  });
});

describe('problemMessage', () => {
  it('muestra los errores de validación por campo', () => {
    const msg = problemMessage({
      status: 400,
      error: { detail: "Revisa los campos indicados en 'errors'", errors: { name: 'nombre inválido' } },
    });
    expect(msg).toBe('name: nombre inválido');
  });

  it('usa el detail del problema RFC 7807', () => {
    expect(problemMessage({ status: 409, error: { detail: 'La cola ya existe' } })).toBe('La cola ya existe');
  });

  it('explica el 403 por rol', () => {
    expect(problemMessage({ status: 403, error: null })).toContain('Admin');
  });
});
