import 'server-only';
import crypto from 'node:crypto';

export const GRAPH_URL = 'https://graph.facebook.com/v21.0';

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Valida X-Hub-Signature-256 = "sha256=<hmac hex del cuerpo crudo con META_APP_SECRET>". */
export function verifyMetaSignature(rawBody: Buffer, header: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !header || !header.startsWith('sha256=')) return false;
  const given = header.slice('sha256='.length);
  if (!/^[0-9a-f]{64}$/i.test(given)) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest();
  return safeEqual(Buffer.from(given, 'hex'), expected);
}

/** Respuesta al handshake GET de Meta (hub.mode / hub.verify_token / hub.challenge). */
export function handleVerification(request: Request): Response {
  const params = new URL(request.url).searchParams;
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token') ?? '';
  const challenge = params.get('hub.challenge') ?? '';
  const expected = process.env.META_VERIFY_TOKEN ?? '';
  if (mode === 'subscribe' && expected && safeEqual(Buffer.from(token), Buffer.from(expected))) {
    return new Response(challenge.slice(0, 200), { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return new Response('Forbidden', { status: 403 });
}

/** Lee el cuerpo crudo, valida la firma y devuelve el JSON, o null si la firma no es válida. */
export async function readSignedJson<T>(request: Request): Promise<{ ok: true; body: T } | { ok: false; status: number }> {
  const raw = Buffer.from(await request.arrayBuffer());
  if (!verifyMetaSignature(raw, request.headers.get('x-hub-signature-256'))) return { ok: false, status: 401 };
  try {
    return { ok: true, body: JSON.parse(raw.toString('utf8')) as T };
  } catch {
    return { ok: false, status: 400 };
  }
}

// ---------- Lead Ads ----------

export type MetaLeadField = { name: string; values?: string[] };
export type MetaLead = {
  id: string;
  created_time?: string;
  field_data?: MetaLeadField[];
  ad_id?: string;
  ad_name?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  form_id?: string;
  platform?: string;
};

async function graphGet<T>(path: string, fields: string): Promise<T> {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) throw new Error('Falta META_PAGE_ACCESS_TOKEN');
  // Token en cabecera (no en la URL) para que no quede en logs.
  const res = await fetch(`${GRAPH_URL}/${encodeURIComponent(path)}?fields=${fields}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    let code = '';
    try {
      const j = (await res.json()) as { error?: { code?: number; message?: string } };
      code = `${j.error?.code ?? ''} ${j.error?.message ?? ''}`.slice(0, 200);
    } catch {}
    throw new Error(`Graph API ${res.status} ${code}`);
  }
  return (await res.json()) as T;
}

/** Obtiene un lead de Lead Ads. Si los campos de campaña no están permitidos, reintenta con lo básico. */
export async function fetchMetaLead(leadgenId: string): Promise<MetaLead> {
  try {
    return await graphGet<MetaLead>(
      leadgenId,
      'id,created_time,field_data,ad_id,ad_name,adset_name,campaign_id,campaign_name,form_id,platform',
    );
  } catch {
    return graphGet<MetaLead>(leadgenId, 'id,created_time,field_data,ad_id,form_id');
  }
}

const NAME_KEYS = ['full_name', 'nombre_completo', 'nombre', 'name'];
const FIRST_KEYS = ['first_name', 'nombre'];
const LAST_KEYS = ['last_name', 'apellido', 'apellidos'];
const PHONE_KEYS = ['phone_number', 'phone', 'telefono', 'teléfono', 'celular', 'whatsapp', 'numero_de_telefono', 'número_de_teléfono'];
const EMAIL_KEYS = ['email', 'correo', 'correo_electronico', 'correo_electrónico', 'e-mail'];

function key(name: string) {
  return name.trim().toLowerCase();
}

/** Separa los campos comunes del resto de respuestas del formulario. */
export function mapMetaLead(lead: MetaLead) {
  const fields = new Map<string, string>();
  for (const f of lead.field_data ?? []) {
    const value = (f.values ?? []).join(', ').trim();
    if (value) fields.set(key(f.name), value);
  }
  const pick = (keys: string[]) => {
    for (const k of keys) {
      const v = fields.get(k);
      if (v) return { k, v };
    }
    return null;
  };

  const used = new Set<string>();
  let name = pick(NAME_KEYS);
  if (name) used.add(name.k);
  if (!name) {
    const first = pick(FIRST_KEYS);
    const last = pick(LAST_KEYS);
    if (first || last) {
      if (first) used.add(first.k);
      if (last) used.add(last.k);
      name = { k: '', v: [first?.v, last?.v].filter(Boolean).join(' ') };
    }
  }
  const phone = pick(PHONE_KEYS);
  if (phone) used.add(phone.k);
  const email = pick(EMAIL_KEYS);
  if (email) used.add(email.k);

  const extra: string[] = [];
  for (const [k, v] of fields) {
    if (!used.has(k)) extra.push(`- ${k.replace(/_/g, ' ')}: ${v}`);
  }

  const origin = [
    lead.campaign_name && `Campaña: ${lead.campaign_name}`,
    lead.adset_name && `Conjunto: ${lead.adset_name}`,
    lead.ad_name && `Anuncio: ${lead.ad_name}`,
    !lead.ad_name && lead.ad_id && `Anuncio ID: ${lead.ad_id}`,
    lead.form_id && `Formulario ID: ${lead.form_id}`,
    lead.platform && `Plataforma: ${lead.platform}`,
  ].filter(Boolean);

  const notes = [`Lead de Meta Ads${origin.length ? ` (${origin.join(' · ')})` : ''}`, ...extra].join('\n');

  return {
    name: name?.v ?? null,
    phone: phone?.v ?? null,
    email: email?.v ?? null,
    campaign: lead.campaign_name ?? lead.ad_name ?? (lead.campaign_id ? `campaña ${lead.campaign_id}` : null),
    notes,
  };
}
