"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function revalidateInscripciones(eventId: string) {
  revalidatePath(`/admin/eventos/${eventId}/inscripciones`);
  revalidatePath(`/admin/eventos/${eventId}/config`);
}

export async function confirmBusAssignmentsAction(eventId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({ bus_assignments_confirmed_at: new Date().toISOString() })
    .eq("id", eventId);
  if (error) throw new Error(error.message);
  revalidateInscripciones(eventId);
}

export async function reopenBusAssignmentsAction(eventId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({ bus_assignments_confirmed_at: null })
    .eq("id", eventId);
  if (error) throw new Error(error.message);
  revalidateInscripciones(eventId);
}
