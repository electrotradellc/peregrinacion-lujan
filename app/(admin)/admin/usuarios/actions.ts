"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/client";

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
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/set-password`,
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

export async function updateUserAction(userId: string, formData: FormData) {
  await requireAdmin();

  const fullName = String(formData.get("full_name"));
  const whatsappPhone = String(formData.get("whatsapp_phone") || "") || null;
  const role = String(formData.get("role")) as "admin" | "bus_captain";
  const busId = String(formData.get("bus_id") || "") || null;
  const eventId = String(formData.get("event_id") || "") || null;

  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, whatsapp_phone: whatsappPhone, role })
    .eq("id", userId);
  if (error) throw new Error(error.message);

  // Se reemplaza la asignación de micro en vez de tratar de "actualizarla" —
  // así cubre los 3 casos (cambió de micro, dejó de ser capitán, no tenía
  // ninguna) con la misma lógica simple.
  await supabase.from("bus_captain_assignments").delete().eq("profile_id", userId);
  if (role === "bus_captain" && busId && eventId) {
    await supabase.from("bus_captain_assignments").insert({
      profile_id: userId,
      bus_id: busId,
      event_id: eventId,
    });
  }

  revalidatePath("/admin/usuarios");
  redirect(`/admin/usuarios/${userId}?saved=1`);
}

// Genera un link de invitación nuevo y lo manda por mail — para cuando el
// link original ya venció antes de que la persona llegara a definir su
// contraseña.
export async function resendInviteAction(userId: string) {
  await requireAdmin();

  const admin = createAdminClient();
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
  if (userError || !userData.user?.email) {
    throw new Error(userError?.message ?? "No se encontró el email de este usuario");
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "invite",
    email: userData.user.email,
    options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/set-password` },
  });
  if (linkError || !linkData.properties?.action_link) {
    throw new Error(linkError?.message ?? "No se pudo generar el link de invitación");
  }

  await sendEmail({
    to: userData.user.email,
    subject: "Te reenviamos tu invitación — Peregrinación a Luján",
    text: `Hola,\n\nAcá tenés un link nuevo para entrar y definir tu contraseña (el anterior puede haber vencido):\n${linkData.properties.action_link}\n\nGrupo de Apoyo Luján`,
  });

  redirect(`/admin/usuarios/${userId}?invited=1`);
}
