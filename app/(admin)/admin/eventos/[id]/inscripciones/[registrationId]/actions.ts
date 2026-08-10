"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
      has_health_insurance: bool("has_health_insurance"),
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

  const { error } = await supabase
    .from("registrations")
    .update({ status })
    .eq("id", registrationId);
  if (error) throw new Error(error.message);

  await supabase.from("event_audit_log").insert({
    event_id: eventId,
    actor_id: user?.id,
    action: `registration_status_set_${status}`,
    entity_table: "registrations",
    entity_id: registrationId,
  });

  revalidatePath(`/admin/eventos/${eventId}/inscripciones/${registrationId}`);
  revalidatePath(`/admin/eventos/${eventId}/inscripciones`);
}
