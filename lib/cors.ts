import { NextResponse } from 'next/server';

/** Cabeceras CORS limitadas a SITE_ORIGIN (el sitio web existente). */
export function corsHeaders(request: Request, methods = 'GET, OPTIONS'): Record<string, string> {
  const allowed = (process.env.SITE_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export function preflight(request: Request, methods?: string) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request, methods) });
}
