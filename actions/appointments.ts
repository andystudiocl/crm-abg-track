'use server';

import { revalidatePath } from 'next/cache';
import { getSession, NO_SESSION } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createCalendarEvent, deleteCalendarEvent, revokeToken, appUrl } from '@/lib/google';
import { formInt, formString, formUuid, isUuid } from '@/lib/strings';
import { santiagoLocalToDate, vehicleTitle, formatCLP } from '@/lib/format';
import { formatPhone } from '@/lib/phone';
import type { ActionState } from '@/lib/types';

function revalidateAgenda(leadId?: string) {
  revalidatePath('/calendar');
  revalidatePath('/');
  revalidatePath('/leads');
  if (leadId) revalidatePath(`/leads/${leadId}`);
}

/** Token de Google del asesor (solo legible con service_role). */
async function advisorToken(advisorId: string): Promise<string | null> {
  try {
    const { data } = await createAdminClient()
      .from('advisors')
      .select('google_refresh_token')
      .eq('id', advisorId)
      .maybeSingle();
    return data?.google_refresh_token ?? null;
  } catch {
    return null;
  }
}

export async function createAppointment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const session = await getSession();
  if (!session) return NO_SESSION;
  const { supabase, user } = session;

  const leadId = formUuid(fd, 'lead_id');
  const advisorId = formUuid(fd, 'advisor_id') ?? user.id;
  const vehicleId = formUuid(fd, 'vehicle_id');
  const start = santiagoLocalToDate(String(fd.get('starts_at') ?? ''));
  const duration = formInt(fd, 'duration') ?? 60;
  const notes = formString(fd, 'notes', 2000);

  if (!leadId) return { ok: false, error: 'Elige un lead.' };
  if (!start) return { ok: false, error: 'Indica fecha y hora.' };
  if (duration < 15 || duration > 480) return { ok: false, error: 'La duración debe estar entre 15 y 480 minutos.' };
  if (start.getTime() < Date.now() - 60 * 60 * 1000) return { ok: false, error: 'La fecha ya pasó.' };
  const end = new Date(start.getTime() + duration * 60_000);

  const { data: lead } = await supabase
    .from('leads')
    .select('id, name, phone, email, status, vehicle_id')
    .eq('id', leadId)
    .maybeSingle();
  if (!lead) return { ok: false, error: 'El lead no existe.' };
  const finalVehicleId = vehicleId ?? lead.vehicle_id;

  const { data: appt, error } = await supabase
    .from('appointments')
    .insert({
      lead_id: lead.id,
      advisor_id: advisorId,
      vehicle_id: finalVehicleId,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      notes,
    })
    .select('id')
    .single();
  if (error || !appt) return { ok: false, error: 'No se pudo guardar la reunión.' };

  if (lead.status === 'nuevo' || lead.status === 'contactado') {
    await supabase.from('leads').update({ status: 'agendado' }).eq('id', lead.id);
  }
  revalidateAgenda(lead.id);

  // A partir de aquí, cualquier falla de Google deja la reunión "solo en CRM".
  const token = await advisorToken(advisorId);
  if (!token) {
    return { ok: true, message: 'Reunión agendada (solo en CRM: el asesor no ha conectado Google Calendar).' };
  }

  const { data: vehicle } = finalVehicleId
    ? await supabase.from('vehicles').select('marca, modelo, version, anio, precio_clp').eq('id', finalVehicleId).maybeSingle()
    : { data: null };
  const clientName = lead.name || 'Cliente';
  const vehicleLabel = vehicle ? vehicleTitle(vehicle) : null;

  const result = await createCalendarEvent(token, {
    summary: `Visita ABG: ${clientName}${vehicleLabel ? ` · ${vehicleLabel}` : ''}`,
    description: [
      `Cliente: ${clientName}`,
      lead.phone && `Teléfono: ${formatPhone(lead.phone)}`,
      lead.email && `Correo: ${lead.email}`,
      vehicle && `Auto: ${vehicleLabel} (${formatCLP(vehicle.precio_clp)})`,
      notes && `Notas: ${notes}`,
      `Ficha en CRM: ${appUrl()}/leads/${lead.id}`,
    ]
      .filter(Boolean)
      .join('\n'),
    start,
    end,
    attendeeEmail: lead.email,
  });

  if (!result.ok) {
    if (result.revoked) {
      await createAdminClient().from('advisors').update({ google_refresh_token: null }).eq('id', advisorId);
    }
    return { ok: true, message: `Reunión agendada (solo en CRM). ${result.error}` };
  }

  if (result.id) {
    await supabase.from('appointments').update({ google_event_id: result.id }).eq('id', appt.id);
    revalidateAgenda(lead.id);
  }
  return {
    ok: true,
    message: `Reunión agendada y creada en Google Calendar${lead.email ? ', con invitación al cliente' : ''}.`,
  };
}

export async function deleteAppointment(id: string): Promise<ActionState> {
  if (!isUuid(id)) return { ok: false, error: 'Reunión inválida.' };
  const session = await getSession();
  if (!session) return NO_SESSION;
  const { supabase } = session;

  const { data: appt } = await supabase
    .from('appointments')
    .select('id, lead_id, advisor_id, google_event_id')
    .eq('id', id)
    .maybeSingle();
  if (!appt) return { ok: false, error: 'La reunión no existe.' };

  let googleNote = '';
  if (appt.google_event_id && appt.advisor_id) {
    const token = await advisorToken(appt.advisor_id);
    const removed = token ? await deleteCalendarEvent(token, appt.google_event_id) : false;
    if (!removed) googleNote = ' No se pudo borrar de Google Calendar; elimínalo manualmente.';
  }

  const { error } = await supabase.from('appointments').delete().eq('id', id);
  if (error) return { ok: false, error: 'No se pudo cancelar la reunión.' };
  revalidateAgenda(appt.lead_id);
  return { ok: true, message: 'Reunión cancelada.' + googleNote };
}

export async function disconnectGoogle(): Promise<ActionState> {
  const session = await getSession();
  if (!session) return NO_SESSION;
  const token = await advisorToken(session.user.id);
  if (token) await revokeToken(token);
  const { error } = await createAdminClient()
    .from('advisors')
    .update({ google_refresh_token: null })
    .eq('id', session.user.id);
  if (error) return { ok: false, error: 'No se pudo desconectar Google.' };
  revalidatePath('/calendar');
  return { ok: true, message: 'Google Calendar desconectado.' };
}
