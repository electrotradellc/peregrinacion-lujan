import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Cupos por punto de partida = suma de capacity de sus micros menos
// inscripciones activas (pending_payment o confirmed) — mismo criterio que
// ya usaba el Route Handler de inscripción antes de existir este archivo.
// Un punto sin micros cargados todavía se considera "sin tope" (remaining
// null), no "lleno".
//
// OJO al elegir el cliente: esta función lee `registrations`, cuya política
// RLS de SELECT es admin-only. Desde una página pública (sin sesión) hay que
// pasarle `createAdminClient()`; desde el panel de admin alcanza con el
// cliente de sesión normal.
export interface StartingPointCapacity {
  totalCapacity: number;
  activeCount: number;
  remaining: number | null;
}

export async function getCapacityByStartingPoint(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  eventId: string,
): Promise<Record<string, StartingPointCapacity>> {
  const [{ data: buses }, { data: registrations }] = await Promise.all([
    supabase.from("buses").select("starting_point_id, capacity").eq("event_id", eventId),
    supabase
      .from("registrations")
      .select("starting_point_id")
      .eq("event_id", eventId)
      .in("status", ["pending_payment", "confirmed"]),
  ]);

  const capacityByPoint: Record<string, number> = {};
  for (const bus of buses ?? []) {
    capacityByPoint[bus.starting_point_id] = (capacityByPoint[bus.starting_point_id] ?? 0) + bus.capacity;
  }

  const activeByPoint: Record<string, number> = {};
  for (const reg of registrations ?? []) {
    activeByPoint[reg.starting_point_id] = (activeByPoint[reg.starting_point_id] ?? 0) + 1;
  }

  const startingPointIds = new Set([...Object.keys(capacityByPoint), ...Object.keys(activeByPoint)]);
  const result: Record<string, StartingPointCapacity> = {};
  for (const spId of startingPointIds) {
    const totalCapacity = capacityByPoint[spId] ?? 0;
    const activeCount = activeByPoint[spId] ?? 0;
    result[spId] = {
      totalCapacity,
      activeCount,
      remaining: totalCapacity > 0 ? Math.max(0, totalCapacity - activeCount) : null,
    };
  }
  return result;
}
