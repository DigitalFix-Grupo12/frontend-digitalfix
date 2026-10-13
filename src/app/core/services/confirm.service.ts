import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger: accion destructiva (boton rojo). */
  tone?: 'danger' | 'info';
}

interface PendingConfirm extends Required<ConfirmOptions> {
  resolve: (ok: boolean) => void;
}

/**
 * Dialogo de confirmacion propio (reemplaza window.confirm): accesible,
 * con el estilo de la app y sin bloquear el hilo del navegador.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly current = signal<PendingConfirm | null>(null);

  ask(opts: ConfirmOptions): Promise<boolean> {
    this.current()?.resolve(false);
    return new Promise((resolve) =>
      this.current.set({
        confirmLabel: opts.tone === 'info' ? 'Continuar' : 'Eliminar',
        cancelLabel: 'Cancelar',
        tone: 'danger',
        ...opts,
        resolve,
      })
    );
  }

  answer(ok: boolean): void {
    const c = this.current();
    if (!c) return;
    this.current.set(null);
    c.resolve(ok);
  }
}
