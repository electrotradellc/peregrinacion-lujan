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

// "Salió": marca el micro como cerrado y guarda la hora (pasa a la solapa
// Micros). Se puede reabrir si se marcó por error.
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
// asignación es el "boleto": sirve para saber que se fue y en qué micro. Vale
// también para mover a alguien de un micro a otro, o corregir un micro que ya
// salió.
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

  const invalid = await findIneligible(supabase, [registrationId]);
  if (invalid) return { error: invalid };

  const { error } = await supabase.from("return_assignments").upsert(
    { registration_id: registrationId, return_bus_id: busId, assigned_by: session.userId },
    { onConflict: "registration_id" },
  );
  if (error) return { error: error.message };

  revalidateVuelta(eventId);
  return {};
}

// Quién no puede tener micro de vuelta: no confirmado, vuelve por su cuenta o
// se retiró. Devuelve el motivo, o null si todos pueden.
async function findIneligible(
  supabase: Awaited<ReturnType<typeof createClient>>,
  registrationIds: string[],
): Promise<string | null> {
  const [{ data: registrations }, { data: withdrawals }] = await Promise.all([
    supabase
      .from("registrations")
      .select("id, status, returns_independently")
      .in("id", registrationIds)
      .returns<Pick<RegistrationRow, "id" | "status" | "returns_independently">[]>(),
    supabase
      .from("attendance_checkins")
      .select("registration_id")
      .in("registration_id", registrationIds)
      .eq("event_type", "withdrawn"),
  ]);
  if ((registrations ?? []).length !== registrationIds.length) return "No se encontró alguna inscripción.";
  if ((registrations ?? []).some((r) => r.status !== "confirmed")) return "Alguna inscripción no está confirmada.";
  if ((registrations ?? []).some((r) => r.returns_independently)) return "Alguna persona vuelve por su cuenta.";
  if (withdrawals?.length) return "Alguna persona se retiró de la peregrinación.";
  return null;
}

// Asigna varias personas al mismo micro de una vez (las tildadas en la lista).
// Es todo o nada: si el micro no tiene lugar para todas, no asigna ninguna.
// Con close = true, además marca el micro como que salió.
export async function assignManyToReturnBusAction(
  eventId: string,
  busId: string,
  registrationIds: string[],
  close: boolean,
): Promise<ReturnActionResult> {
  const session = await requireAdmin();
  if (!busId) return { error: "Elegí el micro de vuelta." };
  if (registrationIds.length === 0) return { error: "No hay personas tildadas." };

  const supabase = await createClient();
  const { data: bus } = await supabase
    .from("return_buses")
    .select("bus_number, capacity")
    .eq("id", busId)
    .single<{ bus_number: number; capacity: number }>();
  if (!bus) return { error: "No se encontró el micro." };

  // Los que ya están en este micro no ocupan lugar nuevo.
  const { data: current } = await supabase
    .from("return_assignments")
    .select("registration_id")
    .eq("return_bus_id", busId);
  const inBus = new Set((current ?? []).map((a) => a.registration_id));
  const incoming = registrationIds.filter((id) => !inBus.has(id)).length;
  if (inBus.size + incoming > bus.capacity) {
    const free = Math.max(0, bus.capacity - inBus.size);
    return {
      error: `El micro ${bus.bus_number} tiene ${free} lugar${free === 1 ? "" : "es"} libre${free === 1 ? "" : "s"} y tildaste ${incoming}.`,
    };
  }

  const invalid = await findIneligible(supabase, registrationIds);
  if (invalid) return { error: invalid };

  const { error } = await supabase.from("return_assignments").upsert(
    registrationIds.map((registration_id) => ({
      registration_id,
      return_bus_id: busId,
      assigned_by: session.userId,
    })),
    { onConflict: "registration_id" },
  );
  if (error) return { error: error.message };

  if (close) {
    const { error: closeError } = await supabase
      .from("return_buses")
      .update({ departed_at: new Date().toISOString() })
      .eq("id", busId);
    if (closeError) {
      revalidateVuelta(eventId);
      return { error: `Se asignaron las personas, pero no se pudo cerrar el micro: ${closeError.message}` };
    }
  }

  revalidateVuelta(eventId);
  return {};
}
