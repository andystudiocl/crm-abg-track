import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchMetaLead, handleVerification, mapMetaLead, readSignedJson } from '@/lib/meta';
import { upsertLead } from '@/lib/leads';
import { cleanEmail } from '@/lib/strings';

export const dynamic = 'force-dynamic';

type LeadgenWebhook = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: { leadgen_id?: string | number; form_id?: string; ad_id?: string; page_id?: string };
    }>;
  }>;
};

export async function GET(request: Request) {
  return handleVerification(request);
}

export async function POST(request: Request) {
  const parsed = await readSignedJson<LeadgenWebhook>(request);
  if (!parsed.ok) return new NextResponse(null, { status: parsed.status });

  const leadgenIds: string[] = [];
  for (const entry of parsed.body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const id = change.value?.leadgen_id;
      if (change.field === 'leadgen' && id && /^\d{1,30}$/.test(String(id))) leadgenIds.push(String(id));
    }
  }
  if (!leadgenIds.length) return NextResponse.json({ ok: true });

  const db = createAdminClient();
  let failures = 0;

  for (const leadgenId of leadgenIds) {
    try {
      const lead = await fetchMetaLead(leadgenId);
      const mapped = mapMetaLead(lead);
      await upsertLead(db, {
        source: 'meta_ads',
        external_id: `meta:${leadgenId}`,
        name: mapped.name?.slice(0, 120),
        phone: mapped.phone,
        email: cleanEmail(mapped.email),
        campaign: mapped.campaign?.slice(0, 200),
        notes: mapped.notes.slice(0, 5000),
      });
    } catch (e) {
      failures++;
      console.error(`webhook meta: fallo procesando leadgen ${leadgenId}:`, (e as Error).message);
    }
  }

  // 500 hace que Meta reintente; es seguro porque external_id evita duplicados.
  return NextResponse.json({ ok: failures === 0 }, { status: failures ? 500 : 200 });
}
