/** Recorta, limita el largo y convierte vacío en null. */
export function clean(value: unknown, max = 500): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim().slice(0, max);
  return s.length ? s : null;
}

export function formString(fd: FormData, key: string, max = 500): string | null {
  return clean(fd.get(key), max);
}

export function formInt(fd: FormData, key: string): number | null {
  const raw = fd.get(key);
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/[^\d-]/g, '');
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

export function formUuid(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return isUuid(v) ? v : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function cleanEmail(value: unknown): string | null {
  const s = clean(value, 254);
  return s && EMAIL_RE.test(s) ? s.toLowerCase() : null;
}
