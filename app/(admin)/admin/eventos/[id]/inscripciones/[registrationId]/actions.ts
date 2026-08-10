"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { sendPaymentConfirmedEmail } from "@/lib/email/registrationEmails";
import type { RegistrationRow, EventRow, StartingPointRow, BusAssignmentRow, BusRow } from "@/lib/types";

export async function updateRegistrationAction(
  eventId: string,
  registrationId: string,
  formData: FormData,
) {
  const supabase = await createClient();
  const bool = (name: string) => formData.get(name) === "on";

  const { error } = await supabase
    .from("registrations")
    .update({
      first_name: String(formData.get("first_name")),
      last_name: String(formData.get("last_name")),
      dni: String(formData.get("dni")),
      phone: String(formData.get("phone")),
      email: String(formData.get("email")),
      emergency_contact_name: String(formData.get("emergency_contact_name")),
      emergency_contact_phone: String(formData.get("emergency_contact_phone")),
      returns_independently: bool("returns_independently"),
      has_health_insurance: bool("has_health_insurance"),
      health_insurance_provider: String(formData.get("health_insurance_provider") || "") || null,
      health_insurance_member_number:
        String(formData.get("health_insurance_member_number") || "") || null,
      has_allergies: bool("has_allergies"),
      allergies_detail: String(formData.get("allergies_detail") || "") || null,
      has_celiac: bool("has_celiac"),
      has_diabetes: bool("has_diabetes"),
      has_hypertension: bool("has_hypertension"),
      has_respiratory_condition: bool("has_respiratory_condition"),
      has_heart_condition: bool("has_heart_condition"),
      has_other_condition: bool("has_other_condition"),
      other_condition_detail: String(formData.get("other_condition_detail") || "") || null,
      takes_medication: bool("takes_medication"),
      medication_detail: String(formData.get("medication_detail") || "") || null,
    })
    .eq("id", registrationId);

  if (error) throw new Error(error.message);
  revalidatePath(`/admin/eventos/${eventId}/inscripciones/${registrationId}`);
}

export async function setRegistrationStatusAction(
  eventId: string,
  registrationId: string,
  status: "confirmed" | "cancelled" | "pending_payment",
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: registration, error } = await supabase
    .from("registrations")
    .update({ status })
    .eq("id", registrationId)
    .select()
    .single<RegistrationRow>();
  if (error) throw new Error(error.message);

  await supabase.from("event_audit_log").insert({
    event_id: eventId,
    actor_id: user?.id,
    action: `registration_status_set_${status}`,
    entity_table: "registrations",
    entity_id: registrationId,
  });

  if (status === "confirmed" && registration) {
    try {
      const [{ data: event }, { data: startingPoint }, { data: assignment }] = await Promise.all([
        supabase.from("events").select("*").eq("id", eventId).single<EventRow>(),
        supabase
          .from("starting_points")
          .select("*")
          .eq("id", registration.starting_point_id)
          .single<StartingPointRow>(),
        supabase
          .from("bus_assignments")
          .select("*")
          .eq("registration_id", registrationId)
          .eq("direction", "outbound")
          .maybeSingle<BusAssignmentRow>(),
      ]);
      const bus = assignment
        ? (
            await supabase.from("buses").select("*").eq("id", assignment.bus_id).single<BusRow>()
          ).data
        : null;
      if (event) {
        await sendPaymentConfirmedEmail(registration, event, startingPoint ?? null, bus ?? null);
      }
    } catch (err) {
      console.error("No se pudo enviar el email de pago confirmado:", err);
    }
  }

  revalidatePath(`/admin/eventos/${eventId}/inscripciones/${registrationId}`);
  revalidatePath(`/admin/eventos/${eventId}/inscripciones`);
}

// Borrado definitivo — solo permitido para inscripciones ya canceladas (la
// política RLS lo exige también, esto es la doble verificación del lado de
// la app). Antes de borrar, saca las fotos del bucket privado y deja un
// rastro en el historial del evento con el nombre/DNI, ya que después de
// esto la fila deja de existir.
export async function deleteRegistrationAction(eventId: string, registrationId: string) {
  const session = await requireAdmin();
  const supabase = await createClient();

  const { data: registration } = await supabase
    .from("registrations")
    .select("*")
    .eq("id", registrationId)
    .single<RegistrationRow>();

  if (!registration) throw new Error("No se encontró la inscripción");
  if (registration.status !== "cancelled") {
    throw new Error("Solo se pueden eliminar inscripciones canceladas");
  }

  const admin = createAdminClient();
  const paths = [registration.dni_photo_path, registration.health_insurance_card_photo_path].filter(
    (p): p is string => !!p,
  );
  if (paths.length) {
    await admin.storage.from("registration-documents").remove(paths);
  }

  await supabase.from("event_audit_log").insert({
    event_id: eventId,
    actor_id: session.userId,
    action: "registration_deleted",
    entity_table: "registrations",
    entity_id: registrationId,
    diff: { first_name: registration.first_name, last_name: registration.last_name, dni: registration.dni },
  });

  const { error } = await supabase.from("registrations").delete().eq("id", registrationId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/eventos/${eventId}/inscripciones`);
  redirect(`/admin/eventos/${eventId}/inscripciones`);
}
