import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente con la service role key: ignora RLS por completo.
//
// USO RESTRINGIDO A propósito — solo para lo que un usuario autenticado
// normal no puede/debe poder hacer con su propia sesión:
//   - el webhook de Mercado Pago (no hay usuario logueado, MP llama al server)
//   - subir/leer las fotos de DNI y carnet de obra social (bucket privado)
//   - crear cuentas de capitanes vía Supabase Auth Admin API
//   - el cron de expiración de inscripciones pendientes de pago
//
// El resto de la app (CRUD de admin, lectura de capitanes) debe usar
// lib/supabase/server.ts con la sesión real del usuario, para que RLS siga
// siendo la única fuente de verdad de autorización en esos casos.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
