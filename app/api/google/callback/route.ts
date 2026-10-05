import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { getUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { appUrl, oauthClient, OAUTH_NONCE_COOKIE } from '@/lib/google';

export const dynamic = 'force-dynamic';

function done(result: 'ok' | 'error' | 'sin_token') {
  const res = NextResponse.redirect(`${appUrl()}/calendar?google=${result}`);
  res.cookies.set(OAUTH_NONCE_COOKIE, '', { path: '/api/google', maxAge: 0 });
  return res;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get('code');
  const state = params.get('state') ?? '';
  if (params.get('error') || !code) return done('error');

  const user = await getUser();
  const [stateUser, stateNonce] = state.split('.');
  const cookieNonce = request.cookies.get(OAUTH_NONCE_COOKIE)?.value ?? '';
  const nonceOk =
    stateNonce?.length === 32 &&
    cookieNonce.length === 32 &&
    crypto.timingSafeEqual(Buffer.from(stateNonce), Buffer.from(cookieNonce));
  // Solo se acepta si el usuario logueado es el mismo que inició el flujo.
  if (!user || stateUser !== user.id || !nonceOk) return done('error');

  try {
    const { tokens } = await oauthClient().getToken(code);
    if (!tokens.refresh_token) return done('sin_token');
    // Con service_role: el navegador no tiene permiso de escritura sobre esta columna.
    const { error } = await createAdminClient()
      .from('advisors')
      .update({ google_refresh_token: tokens.refresh_token })
      .eq('id', user.id);
    if (error) return done('error');
    return done('ok');
  } catch {
    console.error('google callback: no se pudo canjear el código');
    return done('error');
  }
}
