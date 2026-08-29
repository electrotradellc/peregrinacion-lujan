"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { magicLinkPath } from "@/lib/magicLink";
import { siteUrl } from "@/lib/email/registrationEmails";
import { sendEmail } from "@/lib/email/client";
import type { RegistrationRow, EventRow } from "@/lib/types";

// Autoservicio para el peregrino que perdió su link de /mi-inscripcion — pide
// DNI + email (nunca muestra el resultado en pantalla, siempre el mismo
// mensaje de éxito exista o no una coincidencia) y, si hay una inscripción
// que matchea ambos datos, le reenvía el link mágico a esa casilla. No se
// puede usar esta pantalla para confirmar si un DNI está o no inscripto.
export async function resendMagicLinkAction(formData: FormData) {
  const dni = String(formData.get("dni") || "").trim();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();

  if (dni && email) {
    const admin = createAdminClient();
    const { data: registration } = await admin
      .from("registrations")
      .select("*")
      .eq("dni", dni)
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<RegistrationRow>();

    if (registration) {
      const { data: event } = await admin
        .from("events")
        .select("*")
        .eq("id", registration.event_id)
        .single<EventRow>();

      if (event) {
        const link = `${siteUrl()}${magicLinkPath(registration.id)}`;
        try {
          await sendEmail({
            to: registration.email,
            subject: `Tu link de inscripción — ${event.name}`,
            text: `Hola ${registration.first_name}, acá tenés el link para ver el estado de tu inscripción a la ${event.name}:\n\n${link}`,
          });
        } catch (err) {
          console.error("No se pudo reenviar el link mágico:", err);
        }
      }
    }
  }

  redirect("/recuperar?enviado=1");
}
