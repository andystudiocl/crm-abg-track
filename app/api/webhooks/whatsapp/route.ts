import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { handleVerification, readSignedJson } from '@/lib/meta';
import { messageBody, type WaWebhook } from '@/lib/whatsapp';
import { upsertLead } from '@/lib/leads';
import { normalizePhone } from '@/lib/phone';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleVerification(request);
}

export async function POST(request: Request) {
  const parsed = await readSignedJson<WaWebhook>(request);
  if (!parsed.ok) return new NextResponse(null, { status: parsed.status });

  const db = createAdminClient();
  let failures = 0;

  for (const entry of parsed.body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      // Los "statuses" (entregado/leído) llegan sin messages y se ignoran.
      if (change.field !== 'messages' || !value?.messages?.length) continue;

      for (const msg of value.messages) {
        try {
          if (!msg.id || !msg.from) continue;
          const waId = String(msg.id).slice(0, 200);

          const { data: dup } = await db.from('lead_messages').select('id').eq('wa_message_id', waId).maybeSingle();
          if (dup) continue;

          const phone = normalizePhone(msg.from);
          if (!phone) continue;
          const profileName = value.contacts?.find((c) => c.wa_id === msg.from)?.profile?.name;
          const ts = Number(msg.timestamp);
          const sentAt = Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000).toISOString() : new Date().toISOString();

          const { id: leadId } = await upsertLead(db, {
            source: 'whatsapp',
            phone,
            name: profileName?.slice(0, 120) ?? null,
            last_message_at: sentAt,
          });

          const { error } = await db.from('lead_messages').insert({
            lead_id: leadId,
            direction: 'in',
            body: messageBody(msg).slice(0, 4096),
            wa_message_id: waId,
            created_at: sentAt,
          });
          // 23505 = ya guardado por un reintento concurrente.
          if (error && error.code !== '23505') throw new Error(`insert mensaje ${error.code}`);
        } catch (e) {
          failures++;
          console.error('webhook whatsapp: fallo procesando mensaje:', (e as Error).message);
        }
      }
    }
  }

  // 500 => Meta reintenta; wa_message_id único evita duplicados.
  return NextResponse.json({ ok: failures === 0 }, { status: failures ? 500 : 200 });
}
