'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSession, NO_SESSION } from '@/lib/supabase/server';
import { upsertLead } from '@/lib/leads';
import { normalizePhone } from '@/lib/phone';
import { cleanEmail, formString, formUuid, isUuid } from '@/lib/strings';
import { LEAD_STATUSES } from '@/lib/format';
import type { LeadStatus } from '@/lib/database.types';
import type { ActionState } from '@/lib/types';

function parseStatus(v: unknown): LeadStatus | null {
  return typeof v === 'string' && (LEAD_STATUSES as string[]).includes(v) ? (v as LeadStatus) : null;
}

function revalidateLead(id?: string) {
  revalidatePath('/leads');
  revalidatePath('/');
  if (id) revalidatePath(`/leads/${id}`);
}

export async function createLead(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const session = await getSession();
  if (!session) return NO_SESSION;

  const name = formString(fd, 'name', 120);
  const rawPhone = formString(fd, 'phone', 30);
  const phone = normalizePhone(rawPhone);
  const rawEmail = formString(fd, 'email', 254);
  const email = cleanEmail(rawEmail);

  if (!name) return { ok: false, error: 'El nombre es obligatorio.' };
  if (rawPhone && !phone) return { ok: false, error: 'El teléfono no parece válido.' };
  if (rawEmail && !email) return { ok: false, error: 'El correo no parece válido.' };
  if (!phone && !email) return { ok: false, error: 'Ingresa al menos un teléfono o correo.' };

  let result;
  try {
    result = await upsertLead(session.supabase, {
      source: 'manual',
      name,
      phone,
      email,
      vehicle_id: formUuid(fd, 'vehicle_id'),
      advisor_id: formUuid(fd, 'advisor_id'),
      campaign: formString(fd, 'campaign', 200),
      notes: formString(fd, 'notes', 5000),
    });
  } catch {
    return { ok: false, error: 'No se pudo crear el lead. Intenta de nuevo.' };
  }
  revalidateLead(result.id);
  redirect(`/leads/${result.id}${result.created ? '' : '?existente=1'}`);
}

export async function updateLeadStatus(id: string, status: LeadStatus): Promise<ActionState> {
  if (!isUuid(id) || !parseStatus(status)) return { ok: false, error: 'Datos inválidos.' };
  const session = await getSession();
  if (!session) return NO_SESSION;
  const { error } = await session.supabase.from('leads').update({ status }).eq('id', id);
  if (error) return { ok: false, error: 'No se pudo cambiar el estado.' };
  revalidateLead(id);
  return { ok: true };
}

export async function updateLead(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = fd.get('id');
  if (!isUuid(id)) return { ok: false, error: 'Lead inválido.' };
  const session = await getSession();
  if (!session) return NO_SESSION;

  const rawPhone = formString(fd, 'phone', 30);
  const phone = normalizePhone(rawPhone);
  const rawEmail = formString(fd, 'email', 254);
  const email = cleanEmail(rawEmail);
  const status = parseStatus(fd.get('status'));
  if (rawPhone && !phone) return { ok: false, error: 'El teléfono no parece válido.' };
  if (rawEmail && !email) return { ok: false, error: 'El correo no parece válido.' };
  if (!status) return { ok: false, error: 'Estado inválido.' };

  const { error } = await session.supabase
    .from('leads')
    .update({
      name: formString(fd, 'name', 120) ?? '',
      phone,
      email,
      status,
      advisor_id: formUuid(fd, 'advisor_id'),
      vehicle_id: formUuid(fd, 'vehicle_id'),
      campaign: formString(fd, 'campaign', 200),
      notes: formString(fd, 'notes', 10000),
    })
    .eq('id', id);
  if (error) return { ok: false, error: 'No se pudieron guardar los cambios.' };
  revalidateLead(id);
  return { ok: true, message: 'Cambios guardados.' };
}

export async function deleteLead(id: string): Promise<ActionState> {
  if (!isUuid(id)) return { ok: false, error: 'Lead inválido.' };
  const session = await getSession();
  if (!session) return NO_SESSION;
  const { error } = await session.supabase.from('leads').delete().eq('id', id);
  if (error) return { ok: false, error: 'No se pudo eliminar el lead.' };
  revalidateLead();
  redirect('/leads');
}
