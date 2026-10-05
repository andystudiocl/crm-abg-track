import 'server-only';
import { GRAPH_URL } from '@/lib/meta';

export const WINDOW_MS = 24 * 60 * 60 * 1000;

export type SendResult = { ok: true; id: string | null } | { ok: false; error: string };

/** Envía un mensaje de texto libre por WhatsApp Cloud API. */
export async function sendWhatsAppText(to: string, body: string): Promise<SendResult> {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneId || !token) return { ok: false, error: 'WhatsApp no está configurado en el servidor.' };

  let res: Response;
  try {
    res = await fetch(`${GRAPH_URL}/${encodeURIComponent(phoneId)}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body },
      }),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, error: 'No se pudo conectar con WhatsApp. Intenta de nuevo.' };
  }

  const json = (await res.json().catch(() => null)) as {
    messages?: Array<{ id?: string }>;
    error?: { code?: number; message?: string };
  } | null;

  if (!res.ok || json?.error) {
    const code = json?.error?.code;
    console.error('whatsapp send: error', res.status, code);
    if (code === 131047) {
      return { ok: false, error: 'Pasaron más de 24 h desde el último mensaje del cliente. Solo se puede escribir con una plantilla aprobada.' };
    }
    if (code === 131026 || code === 131030) return { ok: false, error: 'El número no tiene WhatsApp o no está permitido.' };
    if (code === 190) return { ok: false, error: 'El token de WhatsApp expiró o es inválido. Avísale al administrador.' };
    return { ok: false, error: `WhatsApp rechazó el mensaje${code ? ` (código ${code})` : ''}.` };
  }
  return { ok: true, id: json?.messages?.[0]?.id ?? null };
}

// ---------- Webhook entrante ----------

export type WaMessage = {
  from: string;
  id: string;
  timestamp?: string;
  type: string;
  text?: { body?: string };
  image?: { caption?: string };
  video?: { caption?: string };
  document?: { caption?: string; filename?: string };
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
  reaction?: { emoji?: string };
};

export type WaWebhook = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
        messages?: WaMessage[];
      };
    }>;
  }>;
};

/** Texto para guardar. Lo que no es texto queda como marcador, ej. "[image] foto del auto". */
export function messageBody(m: WaMessage): string {
  const tag = (extra?: string | null) => `[${m.type}]${extra ? ' ' + extra : ''}`;
  switch (m.type) {
    case 'text':
      return m.text?.body ?? '';
    case 'image':
      return tag(m.image?.caption);
    case 'video':
      return tag(m.video?.caption);
    case 'document':
      return tag(m.document?.caption ?? m.document?.filename);
    case 'location': {
      const l = m.location;
      const coords = l?.latitude !== undefined ? `${l.latitude},${l.longitude}` : '';
      return tag([l?.name, l?.address, coords].filter(Boolean).join(' · '));
    }
    case 'button':
      return m.button?.text ?? tag();
    case 'interactive':
      return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? tag();
    case 'reaction':
      return tag(m.reaction?.emoji);
    default:
      return tag();
  }
}
