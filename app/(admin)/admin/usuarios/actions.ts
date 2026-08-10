"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function createCaptainAction(formData: FormData) {
  await requireAdmin(); // solo un admin logueado puede llegar hasta acá

  const email = String(formData.get("email"));
  const fullName = String(formData.get("full_name"));
  const whatsappPhone = String(formData.get("whatsapp_phone") || "") || null;
  const role = String(formData.get("role")) as "admin" | "bus_captain";
  const busId = String(formData.get("bus_id") || "") || null;
  const eventId = String(formData.get("event_id") || "") || null;

  const admin = createAdminClient();
  // inviteUserByEmail crea la cuenta Y manda el mail con el link para que la
  // persona defina su propia contraseña — no hace falta generar/compartir
  // ninguna contraseña temporal a mano.
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, whatsapp_phone: whatsappPhone, role },
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "No se pudo crear el usuario");
  }

  if (role === "bus_captain" && busId && eventId) {
    const app = await createClient();
    await app.from("bus_captain_assignments").insert({
      profile_id: data.user.id,
      bus_id: busId,
      event_id: eventId,
    });
  }

  revalidatePath("/admin/usuarios");
}
