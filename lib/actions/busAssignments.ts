"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AssignmentDirection } from "@/lib/types";

// Busca el próximo número libre dentro de la "centena" del micro (micro 1 ->
// 101..capacidad, micro 2 -> 201..capacidad, etc.) y se lo asigna a esta
// inscripción. Si ya tenía un código de otro micro, queda liberado solo
// (nadie más lo tenía, era 1 a 1 con esta fila).
async function assignPilgrimCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  registrationId: string,
  busId: string,
) {
  const { data: bus } = await supabase
    .from("buses")
    .select("bus_number, capacity")
    .eq("id", busId)
    .single();
  if (!bus) return;

  const { data: assignedInBus } = await supabase
    .from("bus_assignments")
    .select("registration_id")
    .eq("bus_id", busId)
    .eq("direction", "outbound");

  const registrationIds = (assignedInBus ?? [])
    .map((a) => a.registration_id)
    .filter((id) => id !== registrationId);

  const { data: existingCodes } = registrationIds.length
    ? await supabase.from("registrations").select("pilgrim_code").in("id", registrationIds)
    : { data: [] as { pilgrim_code: number | null }[] };

  const used = new Set((existingCodes ?? []).map((r) => r.pilgrim_code).filter(Boolean));
  let slot = 1;
  while (used.has(bus.bus_number * 100 + slot) && slot <= bus.capacity) slot++;

  await supabase
    .from("registrations")
    .update({ pilgrim_code: bus.bus_number * 100 + slot })
    .eq("id", registrationId);
}

export async function assignToBusAction(
  eventId: string,
  direction: AssignmentDirection,
  registrationId: string,
  formData: FormData,
) {
  const busId = String(formData.get("bus_id") || "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!busId) {
    // "Sin asignar" — quitar la asignación existente, si la había
    await supabase
      .from("bus_assignments")
      .delete()
      .eq("registration_id", registrationId)
      .eq("direction", direction);
    if (direction === "outbound") {
      await supabase.from("registrations").update({ pilgrim_code: null }).eq("id", registrationId);
    }
    revalidatePath(`/admin/eventos/${eventId}/inscripciones`);
    return;
  }

  const { error } = await supabase.from("bus_assignments").upsert(
    {
      registration_id: registrationId,
      bus_id: busId,
      direction,
      assigned_by: user?.id,
    },
    { onConflict: "registration_id,direction" },
  );

  if (error) throw new Error(error.message);

  if (direction === "outbound") {
    await assignPilgrimCode(supabase, registrationId, busId);
  }

  revalidatePath(`/admin/eventos/${eventId}/inscripciones`);
}
