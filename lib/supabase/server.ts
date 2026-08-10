import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente para Server Components / Route Handlers / Server Actions: usa la
// clave anónima + las cookies de sesión del usuario logueado. Respeta RLS
// según ese usuario (admin o capitán) — nunca hace bypass de seguridad.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Se llamó desde un Server Component sin poder escribir cookies.
            // Es inofensivo porque proxy.ts se encarga de refrescar la sesión.
          }
        },
      },
    },
  );
}
