"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AssignmentDirection } from "@/lib/types";

function revalidateAssignment(eventId: string, direction: AssignmentDirection) {
  revalidatePath(
    `/admin/eventos/${eventId}/asignacion-${direction === "outbound" ? "ida" : "vuelta"}`,
  );
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
    revalidateAssignment(eventId, direction);
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
  revalidateAssignment(eventId, direction);
}

export async function copyOutboundToReturnAction(eventId: string, registrationIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: outbound } = await supabase
    .from("bus_assignments")
    .select("registration_id, bus_id")
    .eq("direction", "outbound")
    .in("registration_id", registrationIds);

  for (const a of outbound ?? []) {
    await supabase.from("bus_assignments").upsert(
      {
        registration_id: a.registration_id,
        bus_id: a.bus_id,
        direction: "return",
        assigned_by: user?.id,
      },
      { onConflict: "registration_id,direction" },
    );
  }

  revalidateAssignment(eventId, "return");
}
