import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/database.types';

/** Cliente con la sesión del usuario (respeta RLS). Para Server Components, Actions y Route Handlers. */
export function createClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Llamado desde un Server Component: no puede escribir cookies.
            // El middleware ya refresca la sesión, así que se puede ignorar.
          }
        },
      },
    },
  );
}

/** Usuario autenticado actual (validado contra Supabase Auth) o null. */
export async function getUser() {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/** Para Server Actions: cliente + usuario, o null si la sesión expiró. */
export async function getSession() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

export const NO_SESSION = { ok: false, error: 'Sesión expirada. Vuelve a iniciar sesión.' } as const;
