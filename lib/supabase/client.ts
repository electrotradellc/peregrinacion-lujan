import { createBrowserClient } from "@supabase/ssr";

// Cliente para Client Components: usa la clave anónima, respeta RLS según la
// sesión del usuario logueado (o anon si no hay sesión).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
