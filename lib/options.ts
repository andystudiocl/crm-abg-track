import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { formatCLP, vehicleTitle } from '@/lib/format';

export type Option = { value: string; label: string };

export async function getAdvisorOptions(db: SupabaseClient<Database>): Promise<Option[]> {
  const { data } = await db.from('advisors').select('id, name, email').order('name');
  return (data ?? []).map((a) => ({ value: a.id, label: a.name || a.email }));
}

/** Autos no vendidos (más el indicado, aunque esté vendido, para no perder la selección actual). */
export async function getVehicleOptions(db: SupabaseClient<Database>, includeId?: string | null): Promise<Option[]> {
  const { data } = await db
    .from('vehicles')
    .select('id, marca, modelo, version, anio, precio_clp, status')
    .order('marca')
    .order('modelo');
  return (data ?? [])
    .filter((v) => v.status !== 'vendido' || v.id === includeId)
    .map((v) => ({
      value: v.id,
      label: `${vehicleTitle(v)} · ${formatCLP(v.precio_clp)}${v.status === 'vendido' ? ' (vendido)' : ''}`,
    }));
}
