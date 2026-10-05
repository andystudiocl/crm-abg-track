import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, LeadRow, LeadSource } from '@/lib/database.types';
import { normalizePhone } from '@/lib/phone';

export type LeadInput = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  source: LeadSource;
  vehicle_id?: string | null;
  advisor_id?: string | null;
  campaign?: string | null;
  notes?: string | null;
  external_id?: string | null;
  last_message_at?: string | null;
};

export type UpsertResult = { id: string; created: boolean };

type Client = SupabaseClient<Database>;
type LeadUpdate = Database['public']['Tables']['leads']['Update'];

const FILLABLE = ['name', 'phone', 'email', 'vehicle_id', 'advisor_id', 'campaign', 'external_id'] as const;

async function findExisting(db: Client, externalId: string | null, phone: string | null): Promise<LeadRow | null> {
  if (externalId) {
    const { data, error } = await db.from('leads').select('*').eq('external_id', externalId).maybeSingle();
    if (error) throw new Error(`No se pudo buscar el lead (${error.code || 'red'})`);
    if (data) return data;
  }
  if (phone) {
    const { data, error } = await db
      .from('leads')
      .select('*')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`No se pudo buscar el lead (${error.code || 'red'})`);
    if (data) return data;
  }
  return null;
}

/**
 * Crea o actualiza un lead evitando duplicados:
 * 1) busca por external_id, 2) por teléfono normalizado.
 * Si existe, solo completa campos vacíos. Las notas nuevas se agregan al final
 * (si no estaban ya), para no perder el mensaje de un cliente que vuelve a escribir.
 */
export async function upsertLead(db: Client, input: LeadInput): Promise<UpsertResult> {
  const phone = normalizePhone(input.phone);
  const values = {
    name: input.name?.trim() || null,
    phone,
    email: input.email?.trim().toLowerCase() || null,
    vehicle_id: input.vehicle_id ?? null,
    advisor_id: input.advisor_id ?? null,
    campaign: input.campaign?.trim() || null,
    external_id: input.external_id ?? null,
  };
  const notes = input.notes?.trim() || null;

  const existing = await findExisting(db, values.external_id, phone);

  if (existing) {
    const patch: LeadUpdate = {};
    for (const key of FILLABLE) {
      const incoming = values[key];
      if (incoming && !existing[key]) patch[key] = incoming;
    }
    if (notes && !(existing.notes ?? '').includes(notes)) {
      patch.notes = existing.notes ? `${existing.notes}\n\n${notes}` : notes;
    }
    if (input.last_message_at) patch.last_message_at = input.last_message_at;
    if (Object.keys(patch).length) {
      const { error } = await db.from('leads').update(patch).eq('id', existing.id);
      if (error) throw new Error(`No se pudo actualizar el lead (${error.code})`);
    }
    return { id: existing.id, created: false };
  }

  const { data, error } = await db
    .from('leads')
    .insert({
      ...values,
      name: values.name ?? '',
      source: input.source,
      notes,
      last_message_at: input.last_message_at ?? null,
    })
    .select('id')
    .single();

  if (error?.code === '23505') {
    // Carrera con otra petición (ej. reintento del webhook): ya existe, se reintenta como actualización.
    const again = await findExisting(db, values.external_id, phone);
    if (again) return { id: again.id, created: false };
  }
  if (error || !data) throw new Error(`No se pudo crear el lead (${error?.code ?? 'sin datos'})`);
  return { id: data.id, created: true };
}
