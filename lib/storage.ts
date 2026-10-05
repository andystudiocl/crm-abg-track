export const VEHICLE_BUCKET = 'vehicles';

/** URL pública de una foto del bucket (el bucket es público). Sirve en servidor y navegador. */
export function photoUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${base}/storage/v1/object/public/${VEHICLE_BUCKET}/${encoded}`;
}

type PhotoLike = { path: string; position: number; is_cover: boolean };

/** Portada primero y luego por posición. */
export function sortPhotos<T extends PhotoLike>(photos: T[] | null | undefined): T[] {
  return [...(photos ?? [])].sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.position - b.position);
}

export function coverPath(photos: PhotoLike[] | null | undefined): string | null {
  return sortPhotos(photos)[0]?.path ?? null;
}
