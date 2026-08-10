"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Toggle rápido desde la lista de Inscripciones — evita tener que entrar a
// la ficha completa solo para esto. Al marcarlo, la persona deja de
// aparecer como opción asignable en el combo de micro de vuelta.
export async function setReturnsIndependentlyAction(
  eventId: string,
  registrationId: string,
  formData: FormData,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("registrations")
    .update({ returns_independently: formData.get("returns_independently") === "on" })
    .eq("id", registrationId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/eventos/${eventId}/inscripciones`);
}
