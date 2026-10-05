import type { LeadStatus, VehicleStatus } from '@/lib/database.types';
import { LEAD_STATUS_LABEL, VEHICLE_STATUS_LABEL } from '@/lib/format';

const VEHICLE_CLASS: Record<VehicleStatus, string> = {
  en_camino: 'badge badge-info',
  disponible: 'badge badge-ok',
  reservado: 'badge badge-gold',
  vendido: 'badge',
};

const LEAD_CLASS: Record<LeadStatus, string> = {
  nuevo: 'badge badge-gold',
  contactado: 'badge badge-info',
  agendado: 'badge badge-info',
  negociacion: 'badge badge-gold',
  ganado: 'badge badge-ok',
  perdido: 'badge badge-danger',
};

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  return <span className={VEHICLE_CLASS[status]}>{VEHICLE_STATUS_LABEL[status]}</span>;
}

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <span className={LEAD_CLASS[status]}>{LEAD_STATUS_LABEL[status]}</span>;
}
