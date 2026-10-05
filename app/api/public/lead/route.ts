import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { corsHeaders, preflight } from '@/lib/cors';
import { upsertLead } from '@/lib/leads';
import { normalizePhone } from '@/lib/phone';
import { clean, cleanEmail, isUuid } from '@/lib/strings';
import { vehicleTitle } from '@/lib/format';

export const dynamic = 'force-dynamic';

const METHODS = 'POST, OPTIONS';
const MAX_BODY = 16 * 1024;

export async function OPTIONS(request: Request) {
  return preflight(request, METHODS);
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const raw = await request.text();
  if (raw.length > MAX_BODY) return null;
  const type = request.headers.get('content-type') ?? '';
  try {
    if (type.includes('application/x-www-form-urlencoded')) {
      return Object.fromEntries(new URLSearchParams(raw));
    }
    const data: unknown = JSON.parse(raw);
    return data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** POST /api/public/lead  { name, phone, email, message, vehicle_id, website (trampa) } */
export async function POST(request: Request) {
  const headers = corsHeaders(request, METHODS);
  const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers });

  const len = Number(request.headers.get('content-length') ?? 0);
  if (len > MAX_BODY) return reply({ ok: false, error: 'Solicitud demasiado grande' }, 413);

  const body = await readBody(request);
  if (!body) return reply({ ok: false, error: 'Formato inválido' }, 400);

  // Campo trampa: los bots lo llenan. Se responde ok para no darles pistas.
  if (clean(body.website, 200)) return reply({ ok: true });

  const name = clean(body.name, 120);
  const rawPhone = clean(body.phone, 30);
  const phone = normalizePhone(rawPhone);
  const email = cleanEmail(body.email);
  const message = clean(body.message, 2000);
  const vehicleId = isUuid(body.vehicle_id) ? body.vehicle_id : null;

  if (!phone && !email) {
    return reply({ ok: false, error: 'Indica un teléfono o correo válido' }, 422);
  }

  try {
    const db = createAdminClient();
    let vehicleLabel: string | null = null;
    let validVehicleId: string | null = null;
    if (vehicleId) {
      const { data: v } = await db.from('vehicles').select('id, marca, modelo, version, anio').eq('id', vehicleId).maybeSingle();
      if (v) {
        validVehicleId = v.id;
        vehicleLabel = vehicleTitle(v);
      }
    }

    const notes = [
      'Consulta desde el sitio web',
      vehicleLabel && `Auto consultado: ${vehicleLabel}`,
      rawPhone && !phone && `Teléfono no reconocido: ${rawPhone}`,
      message && `Mensaje: ${message}`,
    ]
      .filter(Boolean)
      .join('\n');

    await upsertLead(db, {
      source: 'web',
      name,
      phone,
      email,
      vehicle_id: validVehicleId,
      notes,
    });
    return reply({ ok: true });
  } catch (e) {
    console.error('public/lead:', (e as Error).message);
    return reply({ ok: false, error: 'No pudimos registrar tu consulta. Intenta nuevamente.' }, 500);
  }
}
