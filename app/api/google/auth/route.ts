import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getUser } from '@/lib/supabase/server';
import { appUrl, googleAuthUrl, googleConfigured, OAUTH_NONCE_COOKIE } from '@/lib/google';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.redirect(`${appUrl()}/login?next=/calendar`);
  if (!googleConfigured()) return NextResponse.redirect(`${appUrl()}/calendar?google=error`);

  // state = id del asesor + nonce ligado a una cookie, para que nadie pueda
  // completar el flujo con su propia cuenta de Google en la sesión de otro asesor.
  const nonce = crypto.randomBytes(16).toString('hex');
  const res = NextResponse.redirect(googleAuthUrl(`${user.id}.${nonce}`));
  res.cookies.set(OAUTH_NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: appUrl().startsWith('https://'),
    sameSite: 'lax',
    path: '/api/google',
    maxAge: 600,
  });
  return res;
}
