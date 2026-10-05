/**
 * Normaliza un teléfono a formato internacional sin "+", pensado para Chile.
 *   "+56 9 1234 5678" -> "56912345678"
 *   "9 1234 5678"     -> "56912345678"
 *   "1234 5678"       -> "56912345678" (formato móvil antiguo de 8 dígitos)
 *   "22 123 4567"     -> "56221234567" (fijo)
 * Números extranjeros que ya vienen con código de país (10+ dígitos) se dejan tal cual.
 * Devuelve null si no parece un teléfono.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let d = String(input).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('56') && d.length === 11) return d;
  if (d.startsWith('0')) d = d.replace(/^0+/, '');
  if (d.length === 9) return '56' + d;
  if (d.length === 8) return '569' + d;
  if (d.length >= 10 && d.length <= 15) return d;
  return null;
}

/** "56912345678" -> "+56 9 1234 5678" */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  if (/^569\d{8}$/.test(phone)) return `+56 9 ${phone.slice(3, 7)} ${phone.slice(7)}`;
  if (/^56\d{9}$/.test(phone)) return `+56 ${phone.slice(2, 3)} ${phone.slice(3, 7)} ${phone.slice(7)}`;
  return '+' + phone;
}
