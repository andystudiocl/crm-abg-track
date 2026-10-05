'use server';

import { revalidatePath } from 'next/cache';
import { getSession, NO_SESSION } from '@/lib/supabase/server';
import { sendWhatsAppText, WINDOW_MS } from '@/lib/whatsapp';
import { formString, isUuid } from '@/lib/strings';
import type { ActionState } from '@/lib/types';

export async function sendWhatsApp(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const leadId = fd.get('lead_id');
  if (!isUuid(leadId)) return { ok: false, error: 'Lead inválido.' };
  const body = formString(fd, 'body', 4096);
  if (!body) return { ok: false, error: 'Escribe un mensaje.' };

  const session = await getSession();
  if (!session) return NO_SESSION;
  const { supabase } = session;

  const { data: lead } = await supabase.from('leads').select('id, phone, status, last_message_at').eq('id', leadId).maybeSingle();
  if (!lead) return { ok: false, error: 'El lead no existe.' };
  if (!lead.phone) return { ok: false, error: 'El lead no tiene teléfono.' };
  // last_message_at = último mensaje del cliente. Fuera de 24 h, Meta exige plantilla.
  if (!lead.last_message_at || Date.now() - new Date(lead.last_message_at).getTime() > WINDOW_MS) {
    return {
      ok: false,
      error: 'Fuera de la ventana de 24 h: el cliente debe escribir primero (o usar una plantilla aprobada, aún no implementado).',
    };
  }

  const sent = await sendWhatsAppText(lead.phone, body);
  if (!sent.ok) return { ok: false, error: sent.error };

  const { error } = await supabase
    .from('lead_messages')
    .insert({ lead_id: lead.id, direction: 'out', body, wa_message_id: sent.id });
  if (lead.status === 'nuevo') {
    await supabase.from('leads').update({ status: 'contactado' }).eq('id', lead.id);
  }
  revalidatePath(`/leads/${lead.id}`);
  revalidatePath('/leads');
  if (error) return { ok: true, message: 'Mensaje enviado, pero no se pudo guardar en el historial.' };
  return { ok: true, message: 'Mensaje enviado.' };
}
