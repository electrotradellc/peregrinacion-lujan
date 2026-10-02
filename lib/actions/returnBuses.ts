"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { RegistrationRow } from "@/lib/types";

// Devuelven { error } en vez de tirar: así la pantalla muestra el motivo
// (micro completo, todavía no llegó, etc.) junto a la fila, en vez de la
// página de error genérica de Next.
export type ReturnActionResult = { error?: string };

function revalidateVuelta(eventId: string) {
  revalidatePath(`/admin/eventos/${eventId}/vuelta`);
  revalidatePath(`/admin/eventos/${eventId}/inscripciones`);
}

export async function addReturnBusAction(eventId: string, formData: FormData): Promise<ReturnActionResult> {
  await requireAdmin();
  const busNumber = Number(formData.get("bus_number"));
  const capacity = Number(formData.get("capacity"));
  if (!Number.isInteger(busNumber) || busNumber < 1) return { error: "El número de micro no es válido." };
  if (!Number.isInteger(capacity) || capacity < 1) return { error: "Los asientos tienen que ser 1 o más." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("return_buses")
    .insert({ event_id: eventId, bus_number: busNumber, capacity });
  if (error) {
    return { error: error.code === "23505" ? `Ya existe el micro ${busNumber} de vuelta.` : error.message };
  }
  revalidateVuelta(eventId);
  return {};
}

export async function updateReturnBusCapacityAction(
  eventId: string,
  busId: string,
  formData: FormData,
): Promise<ReturnActionResult> {
  await requireAdmin();
  const capacity = Number(formData.get("capacity"));
  if (!Number.isInteger(capacity) || capacity < 1) return { error: "Los asientos tienen que ser 1 o más." };

  const supabase = await createClient();
  const { count } = await supabase
    .from("return_assignments")
    .select("id", { count: "exact", head: true })
    .eq("return_bus_id", busId);
  if ((count ?? 0) > capacity) {
    return { error: `Ya hay ${count} personas asignadas: no se puede bajar a ${capacity} asientos.` };
  }

  const { error } = await supabase.from("return_buses").update({ capacity }).eq("id", busId);
  if (error) return { error: error.message };
  revalidateVuelta(eventId);
  return {};
}

// "Salió": cierra el micro (ya no se le puede asignar gente) y guarda la hora.
// Se puede reabrir si se marcó por error.
export async function setReturnBusDepartedAction(
  eventId: string,
  busId: string,
  departed: boolean,
): Promise<ReturnActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("return_buses")
    .update({ departed_at: departed ? new Date().toISOString() : null })
    .eq("id", busId);
  if (error) return { error: error.message };
  revalidateVuelta(eventId);
  return {};
}

export async function deleteReturnBusAction(eventId: string, busId: string): Promise<ReturnActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { count } = await supabase
    .from("return_assignments")
    .select("id", { count: "exact", head: true })
    .eq("return_bus_id", busId);
  if ((count ?? 0) > 0) {
    return { error: "El micro tiene personas asignadas: sacalas primero." };
  }
  const { error } = await supabase.from("return_buses").delete().eq("id", busId);
  if (error) return { error: error.message };
  revalidateVuelta(eventId);
  return {};
}

// Asigna (o saca, con bus_id vacío) el micro de vuelta de una persona. La
// asignación es el "boleto": sirve para saber que se fue y en qué micro.
// Solo se puede asignar a quien marcó "Llegó" en la última parada de la ida.
export async function assignReturnBusAction(
  eventId: string,
  registrationId: string,
  formData: FormData,
): Promise<ReturnActionResult> {
  const session = await requireAdmin();
  const busId = String(formData.get("bus_id") || "");
  const supabase = await createClient();

  if (!busId) {
    const { error } = await supabase.from("return_assignments").delete().eq("registration_id", registrationId);
    if (error) return { error: error.message };
    revalidateVuelta(eventId);
    return {};
  }

  const { data: registration } = await supabase
    .from("registrations")
    .select("status, returns_independently")
    .eq("id", registrationId)
    .single<Pick<RegistrationRow, "status" | "returns_independently">>();
  if (!registration || registration.status !== "confirmed") {
    return { error: "La inscripción no está confirmada." };
  }
  if (registration.returns_independently) {
    return { error: "Esta persona vuelve por su cuenta." };
  }

  const { data: lastStop } = await supabase
    .from("stops")
    .select("id")
    .eq("event_id", eventId)
    .order("sequence_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!lastStop) return { error: "El evento no tiene paradas configuradas." };

  const [{ data: arrivals }, { data: withdrawals }] = await Promise.all([
    supabase
      .from("attendance_checkins")
      .select("id")
      .eq("registration_id", registrationId)
      .eq("stop_id", lastStop.id)
      .eq("direction", "outbound")
      .eq("event_type", "arrival")
      .limit(1),
    supabase
      .from("attendance_checkins")
      .select("id")
      .eq("registration_id", registrationId)
      .eq("event_type", "withdrawn")
      .limit(1),
  ]);
  if (withdrawals?.length) return { error: "Esta persona se retiró de la peregrinación." };
  if (!arrivals?.length) {
    return { error: "No tiene marcada la llegada a la última parada: no se le puede asignar micro de vuelta." };
  }

  const { error } = await supabase.from("return_assignments").upsert(
    { registration_id: registrationId, return_bus_id: busId, assigned_by: session.userId },
    { onConflict: "registration_id" },
  );
  if (error) return { error: error.message };

  revalidateVuelta(eventId);
  return {};
}
