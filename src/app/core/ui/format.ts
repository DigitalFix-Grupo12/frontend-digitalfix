import { WorkOrderStatus } from '../services/workorders.service';

export interface StatusMeta {
  label: string;
  tone: 'open' | 'progress' | 'done' | 'cancel';
  icon: string;
  step: number;
}

/** Presentacion de la maquina de estados del caso DigitalFix. */
export const STATUS_META: Record<WorkOrderStatus, StatusMeta> = {
  CREADA: { label: 'Creada', tone: 'open', icon: 'flag', step: 0 },
  ASIGNADA: { label: 'Asignada', tone: 'progress', icon: 'userCheck', step: 1 },
  EN_DESPLAZAMIENTO: { label: 'En desplazamiento', tone: 'progress', icon: 'truck', step: 2 },
  EN_EJECUCION: { label: 'En ejecución', tone: 'progress', icon: 'wrench', step: 3 },
  CERRADA: { label: 'Cerrada', tone: 'done', icon: 'check', step: 4 },
  CANCELADA: { label: 'Cancelada', tone: 'cancel', icon: 'ban', step: -1 },
};

export const FLOW: WorkOrderStatus[] = ['CREADA', 'ASIGNADA', 'EN_DESPLAZAMIENTO', 'EN_EJECUCION', 'CERRADA'];

export const NEXT_STATUS: Record<WorkOrderStatus, WorkOrderStatus | null> = {
  CREADA: 'ASIGNADA',
  ASIGNADA: 'EN_DESPLAZAMIENTO',
  EN_DESPLAZAMIENTO: 'EN_EJECUCION',
  EN_EJECUCION: 'CERRADA',
  CERRADA: null,
  CANCELADA: null,
};

/** Estados desde los que la regla de negocio permite cancelar. */
export const CANCELLABLE: WorkOrderStatus[] = ['CREADA', 'ASIGNADA', 'EN_DESPLAZAMIENTO'];

export function statusLabel(s: WorkOrderStatus): string {
  return STATUS_META[s]?.label ?? s;
}

export function badgeClass(s: WorkOrderStatus): string {
  return `badge badge--${STATUS_META[s]?.tone ?? 'open'}`;
}

const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

export function timeAgo(iso?: string | null): string {
  if (!iso) return '—';
  const diffSec = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  return rtf.format(Math.round(diffSec / 86400), 'day');
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' });
}

const clpFmt = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
export function clp(n: number): string {
  return clpFmt.format(n);
}

export function initials(name: string): string {
  const parts = name.replace(/[@._-]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function httpErrorMessage(err: { status?: number; error?: unknown; message?: string }): string {
  const body = err.error as { message?: string } | string | null | undefined;
  const msg = typeof body === 'object' && body?.message ? body.message : '';
  switch (err.status) {
    case 0:
      return 'No hay conexión con el API Gateway.';
    case 401:
      return 'Tu sesión expiró. Vuelve a iniciar sesión.';
    case 403:
      return 'Tu rol no tiene permiso para esta acción.';
    case 404:
      return msg || 'No encontrado.';
    case 503:
      return msg || 'Servicio temporalmente no disponible.';
    default:
      return msg || `Error inesperado (HTTP ${err.status}).`;
  }
}
