import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { vehicleTitle } from '@/lib/format';
import type { AppointmentItem } from '@/components/appointment-list';

const SELECT =
  'id, starts_at, ends_at, notes, google_event_id, lead:leads(id, name), advisor:advisors(name, email), vehicle:vehicles(marca, modelo, version, anio)';

/** Próximas reuniones (incluye las que empezaron hace menos de 2 h). */
export async function getUpcomingAppointments(
  db: SupabaseClient<Database>,
  opts: { leadId?: string; limit?: number } = {},
): Promise<AppointmentItem[]> {
  let q = db
    .from('appointments')
    .select(SELECT)
    .gte('starts_at', new Date(Date.now() - 2 * 3_600_000).toISOString())
    .order('starts_at')
    .limit(opts.limit ?? 50);
  if (opts.leadId) q = q.eq('lead_id', opts.leadId);
  const { data } = await q;
  return (data ?? []).map((a) => ({
    id: a.id,
    starts_at: a.starts_at,
    ends_at: a.ends_at,
    notes: a.notes,
    google_event_id: a.google_event_id,
    lead: a.lead ? { id: a.lead.id, name: a.lead.name } : null,
    advisor: a.advisor ? a.advisor.name || a.advisor.email : null,
    vehicle: a.vehicle ? vehicleTitle(a.vehicle) : null,
  }));
}

/** Próxima hora en punto (Chile usa offsets de horas completas, así que también es en punto local). */
export function nextHourDefault(): Date {
  const d = new Date(Date.now() + 3_600_000);
  d.setUTCMinutes(0, 0, 0);
  return d;
}
