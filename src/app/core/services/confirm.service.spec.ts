import { ConfirmService } from './confirm.service';

describe('ConfirmService', () => {
  it('resuelve true al confirmar y cierra el diálogo', async () => {
    const svc = new ConfirmService();
    const p = svc.ask({ title: 'Eliminar', message: '¿Seguro?' });
    expect(svc.current()?.confirmLabel).toBe('Eliminar');
    svc.answer(true);
    expect(await p).toBe(true);
    expect(svc.current()).toBeNull();
  });

  it('una nueva pregunta cancela la anterior', async () => {
    const svc = new ConfirmService();
    const first = svc.ask({ title: 'A', message: 'a' });
    const second = svc.ask({ title: 'B', message: 'b', tone: 'info' });
    expect(await first).toBe(false);
    expect(svc.current()?.confirmLabel).toBe('Continuar');
    svc.answer(false);
    expect(await second).toBe(false);
  });
});
