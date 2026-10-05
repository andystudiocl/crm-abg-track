import 'server-only';
// Solo el módulo de Calendar: importar 'googleapis' completo carga cientos de APIs.
import { auth, calendar } from 'googleapis/build/src/apis/calendar';
import { TZ } from '@/lib/format';

export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
export const OAUTH_NONCE_COOKIE = 'g_oauth_nonce';

export function appUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function oauthClient() {
  return new auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${appUrl()}/api/google/callback`,
  );
}

export function googleAuthUrl(state: string): string {
  return oauthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [GOOGLE_SCOPE],
    state,
  });
}

export type EventInput = {
  summary: string;
  description: string;
  start: Date;
  end: Date;
  attendeeEmail?: string | null;
};

export type EventResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string; revoked?: boolean };

function isInvalidGrant(e: unknown): boolean {
  const err = e as { response?: { data?: { error?: string } }; message?: string };
  return err?.response?.data?.error === 'invalid_grant' || /invalid_grant/.test(err?.message ?? '');
}

/** Crea el evento en el calendario principal del asesor. Nunca lanza: devuelve el error. */
export async function createCalendarEvent(refreshToken: string, input: EventInput): Promise<EventResult> {
  try {
    const client = oauthClient();
    client.setCredentials({ refresh_token: refreshToken });
    const cal = calendar({ version: 'v3', auth: client });
    const res = await cal.events.insert({
      calendarId: 'primary',
      sendUpdates: input.attendeeEmail ? 'all' : 'none',
      requestBody: {
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.start.toISOString(), timeZone: TZ },
        end: { dateTime: input.end.toISOString(), timeZone: TZ },
        attendees: input.attendeeEmail ? [{ email: input.attendeeEmail }] : undefined,
        reminders: { useDefault: true },
      },
    });
    return { ok: true, id: res.data.id ?? null };
  } catch (e) {
    if (isInvalidGrant(e)) {
      return { ok: false, revoked: true, error: 'Google desconectado (permiso revocado o vencido). Vuelve a conectar tu calendario.' };
    }
    const status = (e as { code?: number | string }).code;
    console.error('google calendar: error al crear evento', status ?? '');
    return { ok: false, error: 'Google Calendar no respondió correctamente.' };
  }
}

export async function deleteCalendarEvent(refreshToken: string, eventId: string): Promise<boolean> {
  try {
    const client = oauthClient();
    client.setCredentials({ refresh_token: refreshToken });
    await calendar({ version: 'v3', auth: client }).events.delete({ calendarId: 'primary', eventId, sendUpdates: 'all' });
    return true;
  } catch {
    return false;
  }
}

export async function revokeToken(refreshToken: string): Promise<void> {
  try {
    await oauthClient().revokeToken(refreshToken);
  } catch {
    // Si ya estaba revocado no importa.
  }
}
