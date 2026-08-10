"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createEventAction(formData: FormData) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("events")
    .insert({
      name: String(formData.get("name")),
      event_date: String(formData.get("event_date")),
      registration_price_ars: Number(formData.get("registration_price_ars")),
      status: "draft",
      terms_and_conditions: "",
      terms_version: "1",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear el evento");
  }

  revalidatePath("/admin/eventos");
  redirect(`/admin/eventos/${data.id}/config`);
}

export async function updateEventStatusAction(eventId: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("events").update({ status }).eq("id", eventId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/eventos");
  revalidatePath(`/admin/eventos/${eventId}/config`);
}
