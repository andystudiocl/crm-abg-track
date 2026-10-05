import type { LeadSource, LeadStatus, VehicleStatus } from '@/lib/database.types';

export const TZ = 'America/Santiago';

/** $12.990.000 (sin depender de ICU para que servidor y navegador coincidan). */
export function formatCLP(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const n = Math.round(value);
  const s = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (n < 0 ? '-$' : '$') + s;
}

export function formatKm(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' km';
}

const dateFmt = new Intl.DateTimeFormat('es-CL', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('es-CL', {
  timeZone: TZ,
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const weekdayFmt = new Intl.DateTimeFormat('es-CL', {
  timeZone: TZ,
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const timeFmt = new Intl.DateTimeFormat('es-CL', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });

export function formatDate(iso: string | null | undefined): string {
  return iso ? dateFmt.format(new Date(iso)) : '—';
}
export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTimeFmt.format(new Date(iso)) : '—';
}
export function formatAppointment(iso: string): string {
  return weekdayFmt.format(new Date(iso));
}
export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

/** Diferencia (ms) entre la hora de Santiago y UTC en un instante dado. */
function santiagoOffsetMs(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - date.getTime();
}

/**
 * Convierte "2026-10-10T15:30" (hora de Santiago, de un input datetime-local)
 * a Date UTC. Dos pasadas para manejar el cambio de horario.
 */
export function santiagoLocalToDate(local: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let ts = guess - santiagoOffsetMs(new Date(guess));
  ts = guess - santiagoOffsetMs(new Date(ts));
  return new Date(ts);
}

/** Fecha/hora de Santiago en formato datetime-local, útil para valores por defecto. */
export function toSantiagoLocalInput(date: Date): string {
  const shifted = new Date(date.getTime() + santiagoOffsetMs(date));
  return shifted.toISOString().slice(0, 16);
}

export const LEAD_STATUSES: LeadStatus[] = ['nuevo', 'contactado', 'agendado', 'negociacion', 'ganado', 'perdido'];
export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  agendado: 'Agendado',
  negociacion: 'Negociación',
  ganado: 'Ganado',
  perdido: 'Perdido',
};

export const LEAD_SOURCES: LeadSource[] = ['meta_ads', 'whatsapp', 'web', 'manual'];
export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  meta_ads: 'Meta Ads',
  whatsapp: 'WhatsApp',
  web: 'Sitio web',
  manual: 'Manual',
};

export const VEHICLE_STATUSES: VehicleStatus[] = ['en_camino', 'disponible', 'reservado', 'vendido'];
export const VEHICLE_STATUS_LABEL: Record<VehicleStatus, string> = {
  en_camino: 'En camino',
  disponible: 'Disponible',
  reservado: 'Reservado',
  vendido: 'Vendido',
};

export function vehicleTitle(v: { marca: string; modelo: string; version?: string | null; anio?: number } | null | undefined): string {
  if (!v) return '—';
  return [v.marca, v.modelo, v.version].filter(Boolean).join(' ') + (v.anio ? ` ${v.anio}` : '');
}
