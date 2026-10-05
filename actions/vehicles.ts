'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSession, NO_SESSION } from '@/lib/supabase/server';
import { formInt, formString, isUuid } from '@/lib/strings';
import { VEHICLE_STATUSES } from '@/lib/format';
import { VEHICLE_BUCKET } from '@/lib/storage';
import type { VehicleStatus, Database } from '@/lib/database.types';
import type { ActionState } from '@/lib/types';

type VehicleInsert = Database['public']['Tables']['vehicles']['Insert'];

async function sessionClient() {
  return (await getSession())?.supabase ?? null;
}

function revalidateVehicle(id?: string) {
  revalidatePath('/vehicles');
  revalidatePath('/');
  if (id) revalidatePath(`/vehicles/${id}`);
}

export async function saveVehicle(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = fd.get('id');
  const marca = formString(fd, 'marca', 60);
  const modelo = formString(fd, 'modelo', 80);
  const anio = formInt(fd, 'anio');
  const statusRaw = String(fd.get('status') ?? '');
  const status = (VEHICLE_STATUSES as string[]).includes(statusRaw) ? (statusRaw as VehicleStatus) : 'disponible';
  const arrivedRaw = String(fd.get('arrived_at') ?? '');

  if (!marca || !modelo) return { ok: false, error: 'Marca y modelo son obligatorios.' };
  const currentYear = new Date().getFullYear();
  if (!anio || anio < 1950 || anio > currentYear + 2) return { ok: false, error: 'Ingresa un año válido.' };
  const km = formInt(fd, 'km') ?? 0;
  const precio = formInt(fd, 'precio_clp') ?? 0;
  if (km < 0 || precio < 0) return { ok: false, error: 'Kilometraje y precio no pueden ser negativos.' };

  const wantsPublish = fd.get('published') === 'on';
  const values: VehicleInsert = {
    marca,
    modelo,
    version: formString(fd, 'version', 120),
    anio,
    km,
    precio_clp: precio,
    combustible: formString(fd, 'combustible', 40),
    transmision: formString(fd, 'transmision', 40),
    color: formString(fd, 'color', 40),
    patente: formString(fd, 'patente', 12)?.toUpperCase().replace(/\s+/g, '') ?? null,
    descripcion: formString(fd, 'descripcion', 5000),
    status,
    // Un auto vendido nunca queda publicado (el trigger en la base también lo asegura).
    published: status === 'vendido' ? false : wantsPublish,
    arrived_at: /^\d{4}-\d{2}-\d{2}$/.test(arrivedRaw) ? arrivedRaw : null,
  };

  const supabase = await sessionClient();
  if (!supabase) return NO_SESSION;

  if (isUuid(id)) {
    const { error } = await supabase.from('vehicles').update(values).eq('id', id);
    if (error) return { ok: false, error: 'No se pudo guardar el auto. Intenta de nuevo.' };
    revalidateVehicle(id);
    const note = status === 'vendido' && wantsPublish ? ' Se despublicó porque está vendido.' : '';
    return { ok: true, message: 'Cambios guardados.' + note };
  }

  const { data, error } = await supabase.from('vehicles').insert(values).select('id').single();
  if (error || !data) return { ok: false, error: 'No se pudo crear el auto. Intenta de nuevo.' };
  revalidateVehicle();
  redirect(`/vehicles/${data.id}?nuevo=1`);
}

export async function deleteVehicle(id: string): Promise<ActionState> {
  if (!isUuid(id)) return { ok: false, error: 'Auto inválido.' };
  const supabase = await sessionClient();
  if (!supabase) return NO_SESSION;
  const { data: photos } = await supabase.from('vehicle_photos').select('path').eq('vehicle_id', id);
  if (photos?.length) {
    await supabase.storage.from(VEHICLE_BUCKET).remove(photos.map((p) => p.path));
  }
  const { error } = await supabase.from('vehicles').delete().eq('id', id);
  if (error) return { ok: false, error: 'No se pudo eliminar el auto.' };
  revalidateVehicle();
  redirect('/vehicles');
}

// ---------- Fotos ----------
// Los archivos se suben directo desde el navegador a Storage; estas acciones solo
// registran/ordenan/borran las filas en vehicle_photos.

const PATH_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/i;

export async function registerPhoto(vehicleId: string, path: string): Promise<ActionState> {
  if (!isUuid(vehicleId) || !PATH_RE.test(path) || !path.startsWith(vehicleId + '/')) {
    return { ok: false, error: 'Ruta de foto inválida.' };
  }
  const supabase = await sessionClient();
  if (!supabase) return NO_SESSION;
  const { data: existing } = await supabase
    .from('vehicle_photos')
    .select('position, is_cover')
    .eq('vehicle_id', vehicleId)
    .order('position', { ascending: false });
  const nextPos = existing?.length ? existing[0].position + 1 : 0;
  const hasCover = existing?.some((p) => p.is_cover) ?? false;
  const { error } = await supabase
    .from('vehicle_photos')
    .insert({ vehicle_id: vehicleId, path, position: nextPos, is_cover: !hasCover });
  if (error) return { ok: false, error: 'La foto se subió pero no se pudo registrar.' };
  revalidateVehicle(vehicleId);
  return { ok: true };
}

export async function setCoverPhoto(photoId: string): Promise<ActionState> {
  if (!isUuid(photoId)) return { ok: false, error: 'Foto inválida.' };
  const supabase = await sessionClient();
  if (!supabase) return NO_SESSION;
  const { data: photo } = await supabase.from('vehicle_photos').select('vehicle_id').eq('id', photoId).single();
  if (!photo) return { ok: false, error: 'La foto no existe.' };
  // Primero se quita la portada actual por el índice único de una portada por auto.
  await supabase.from('vehicle_photos').update({ is_cover: false }).eq('vehicle_id', photo.vehicle_id).eq('is_cover', true);
  const { error } = await supabase.from('vehicle_photos').update({ is_cover: true }).eq('id', photoId);
  if (error) return { ok: false, error: 'No se pudo cambiar la portada.' };
  revalidateVehicle(photo.vehicle_id);
  return { ok: true };
}

export async function deletePhoto(photoId: string): Promise<ActionState> {
  if (!isUuid(photoId)) return { ok: false, error: 'Foto inválida.' };
  const supabase = await sessionClient();
  if (!supabase) return NO_SESSION;
  const { data: photo } = await supabase
    .from('vehicle_photos')
    .select('vehicle_id, path, is_cover')
    .eq('id', photoId)
    .single();
  if (!photo) return { ok: false, error: 'La foto no existe.' };

  const { error: storageError } = await supabase.storage.from(VEHICLE_BUCKET).remove([photo.path]);
  if (storageError) return { ok: false, error: 'No se pudo borrar el archivo de la foto.' };
  const { error } = await supabase.from('vehicle_photos').delete().eq('id', photoId);
  if (error) return { ok: false, error: 'No se pudo borrar la foto.' };

  if (photo.is_cover) {
    const { data: next } = await supabase
      .from('vehicle_photos')
      .select('id')
      .eq('vehicle_id', photo.vehicle_id)
      .order('position')
      .limit(1)
      .maybeSingle();
    if (next) await supabase.from('vehicle_photos').update({ is_cover: true }).eq('id', next.id);
  }
  revalidateVehicle(photo.vehicle_id);
  return { ok: true };
}

export async function movePhoto(photoId: string, direction: 'up' | 'down'): Promise<ActionState> {
  if (!isUuid(photoId)) return { ok: false, error: 'Foto inválida.' };
  const supabase = await sessionClient();
  if (!supabase) return NO_SESSION;
  const { data: photo } = await supabase.from('vehicle_photos').select('vehicle_id').eq('id', photoId).single();
  if (!photo) return { ok: false, error: 'La foto no existe.' };
  const { data: all } = await supabase
    .from('vehicle_photos')
    .select('id, position')
    .eq('vehicle_id', photo.vehicle_id)
    .order('position')
    .order('created_at');
  if (!all) return { ok: false, error: 'No se pudo reordenar.' };

  const idx = all.findIndex((p) => p.id === photoId);
  const swapWith = direction === 'up' ? idx - 1 : idx + 1;
  if (idx < 0 || swapWith < 0 || swapWith >= all.length) return { ok: true };

  // Se renumera todo (0..n) para corregir posiciones duplicadas de subidas paralelas.
  const order = all.map((p) => p.id);
  [order[idx], order[swapWith]] = [order[swapWith], order[idx]];
  const updates = order
    .map((id, position) => ({ id, position }))
    .filter(({ id, position }) => all.find((p) => p.id === id)?.position !== position);
  const results = await Promise.all(
    updates.map(({ id, position }) => supabase.from('vehicle_photos').update({ position }).eq('id', id)),
  );
  if (results.some((r) => r.error)) return { ok: false, error: 'No se pudo reordenar.' };
  revalidateVehicle(photo.vehicle_id);
  return { ok: true };
}
