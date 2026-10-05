import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { corsHeaders, preflight } from '@/lib/cors';
import { photoUrl, sortPhotos } from '@/lib/storage';
import { isUuid } from '@/lib/strings';

export const dynamic = 'force-dynamic';

// Campos expuestos al sitio. La patente queda fuera a propósito.
const FIELDS =
  'id, marca, modelo, version, anio, km, precio_clp, combustible, transmision, color, descripcion, status, arrived_at, updated_at, vehicle_photos(path, position, is_cover)';

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/**
 * GET /api/public/vehicles        -> catálogo publicado
 * GET /api/public/vehicles?id=... -> un auto publicado
 */
export async function GET(request: Request) {
  const headers = corsHeaders(request);
  const id = new URL(request.url).searchParams.get('id');
  if (id !== null && !isUuid(id)) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400, headers });
  }

  let query = createAdminClient()
    .from('vehicles')
    .select(FIELDS)
    .eq('published', true)
    .neq('status', 'vendido')
    .order('created_at', { ascending: false });
  if (id) query = query.eq('id', id);

  const { data, error } = await query;
  if (error) {
    console.error('public/vehicles: error de base de datos', error.code);
    return NextResponse.json({ error: 'No disponible' }, { status: 500, headers });
  }

  const vehicles = data.map(({ vehicle_photos, ...v }) => {
    const photos = sortPhotos(vehicle_photos).map((p) => photoUrl(p.path));
    return { ...v, cover: photos[0] ?? null, photos };
  });

  if (id && vehicles.length === 0) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404, headers });
  }

  return NextResponse.json(id ? { vehicle: vehicles[0] } : { vehicles }, {
    headers: { ...headers, 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}
