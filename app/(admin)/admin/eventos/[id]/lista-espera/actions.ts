"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendWaitlistInviteEmail } from "@/lib/email/waitlistEmails";
import type { EventRow, StartingPointRow, WaitlistEntryRow } from "@/lib/types";

// Invita manualmente a los próximos N de la cola de un punto de partida
// (orden de llegada). Pensado para usarse justo después de agregar o
// agrandar un micro en Config — no hay disparo automático: el admin decide
// cuándo agregar el micro según cuánta gente ve anotada acá.
export async function inviteWaitlistAction(
  eventId: string,
  startingPointId: string,
  formData: FormData,
) {
  const supabase = await createClient();
  const count = Math.max(1, Number(formData.get("count")) || 1);

  const [{ data: event }, { data: startingPoint }, { data: waiting }] = await Promise.all([
    supabase.from("events").select("*").eq("id", eventId).single<EventRow>(),
    supabase.from("starting_points").select("*").eq("id", startingPointId).single<StartingPointRow>(),
    supabase
      .from("waitlist_entries")
      .select("*")
      .eq("event_id", eventId)
      .eq("starting_point_id", startingPointId)
      .eq("status", "waiting")
      .order("created_at", { ascending: true })
      .limit(count)
      .returns<WaitlistEntryRow[]>(),
  ]);

  if (!event || !startingPoint || !waiting?.length) {
    revalidatePath(`/admin/eventos/${eventId}/lista-espera`);
    return;
  }

  const ids = waiting.map((w) => w.id);
  const { error } = await supabase
    .from("waitlist_entries")
    .update({ status: "invited", invited_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw new Error(error.message);

  // Mejor esfuerzo: si un email individual falla, seguimos con el resto —
  // ya quedaron marcados como invitados, el admin puede avisar a mano por
  // WhatsApp si hace falta.
  for (const entry of waiting) {
    try {
      await sendWaitlistInviteEmail(entry, event, startingPoint);
    } catch (err) {
      console.error(`No se pudo enviar el email de invitación a ${entry.email}:`, err);
    }
  }

  revalidatePath(`/admin/eventos/${eventId}/lista-espera`);
}

export async function cancelWaitlistEntryAction(eventId: string, entryId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("waitlist_entries")
    .update({ status: "cancelled" })
    .eq("id", entryId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/eventos/${eventId}/lista-espera`);
}
