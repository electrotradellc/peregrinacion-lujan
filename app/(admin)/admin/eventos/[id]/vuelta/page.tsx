import { createClient } from "@/lib/supabase/server";
import type { BusAssignmentRow, BusRow, RegistrationRow, ReturnAssignmentRow, ReturnBusRow, StopRow } from "@/lib/types";
import { ReturnBusesPanel } from "@/components/admin/ReturnBusesPanel";
import { ReturnTable, type ReturnRosterEntry } from "@/components/admin/ReturnTable";

// Vuelta: la lista es la de la Ida (confirmados con micro de ida) menos quienes
// vuelven por su cuenta y quienes se retiraron. Los micros de vuelta son una
// lista propia; asignar a alguien a uno es darle el "boleto", y solo se puede
// si marcó "Llegó" en la última parada de la ida.
export default async function VueltaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: buses }, { data: stops }, { data: returnBuses }] = await Promise.all([
    supabase.from("buses").select("*").eq("event_id", id).returns<BusRow[]>(),
    supabase.from("stops").select("*").eq("event_id", id).order("sequence_order").returns<StopRow[]>(),
    supabase
      .from("return_buses")
      .select("*")
      .eq("event_id", id)
      .order("bus_number")
      .returns<ReturnBusRow[]>(),
  ]);

  const lastStop = stops?.at(-1);
  if (!buses?.length || !lastStop) {
    return (
      <p className="text-sm text-neutral-500">
        Configurá al menos un micro y una parada antes de organizar la vuelta.
      </p>
    );
  }

  const busIds = buses.map((b) => b.id);
  const busNumberById = new Map(buses.map((b) => [b.id, b.bus_number]));
  const returnBusIds = (returnBuses ?? []).map((b) => b.id);

  const [{ data: outbound }, { data: arrivals }, { data: withdrawnRows }, { data: returnAssignments }] =
    await Promise.all([
      supabase
        .from("bus_assignments")
        .select("*, registrations!inner(*)")
        .in("bus_id", busIds)
        .eq("direction", "outbound")
        .eq("registrations.status", "confirmed")
        .returns<(BusAssignmentRow & { registrations: RegistrationRow })[]>(),
      supabase
        .from("attendance_checkins")
        .select("registration_id, recorded_at")
        .in("bus_id", busIds)
        .eq("direction", "outbound")
        .eq("stop_id", lastStop.id)
        .eq("event_type", "arrival"),
      supabase.from("attendance_checkins").select("registration_id").in("bus_id", busIds).eq("event_type", "withdrawn"),
      returnBusIds.length
        ? supabase
            .from("return_assignments")
            .select("*")
            .in("return_bus_id", returnBusIds)
            .returns<ReturnAssignmentRow[]>()
        : Promise.resolve({ data: [] as ReturnAssignmentRow[] }),
    ]);

  const arrivedAtByRegistration = new Map((arrivals ?? []).map((a) => [a.registration_id, a.recorded_at]));
  const withdrawnIds = new Set((withdrawnRows ?? []).map((w) => w.registration_id));
  const returnBusByRegistration = new Map((returnAssignments ?? []).map((a) => [a.registration_id, a.return_bus_id]));

  const countByBus: Record<string, number> = {};
  for (const a of returnAssignments ?? []) {
    countByBus[a.return_bus_id] = (countByBus[a.return_bus_id] ?? 0) + 1;
  }

  const independentCount = (outbound ?? []).filter((a) => a.registrations.returns_independently).length;
  const withdrawnCount = (outbound ?? []).filter(
    (a) => !a.registrations.returns_independently && withdrawnIds.has(a.registration_id),
  ).length;

  const roster: ReturnRosterEntry[] = (outbound ?? [])
    .filter((a) => !a.registrations.returns_independently && !withdrawnIds.has(a.registration_id))
    .map((a) => ({
      registrationId: a.registration_id,
      pilgrimCode: a.registrations.pilgrim_code,
      lastName: a.registrations.last_name,
      firstName: a.registrations.first_name,
      phone: a.registrations.phone,
      outboundBusNumber: busNumberById.get(a.bus_id) ?? null,
      arrivedAt: arrivedAtByRegistration.get(a.registration_id) ?? null,
      returnBusId: returnBusByRegistration.get(a.registration_id) ?? "",
    }));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Vuelta</h1>

      <ReturnBusesPanel eventId={id} buses={returnBuses ?? []} countByBus={countByBus} />

      <ReturnTable
        eventId={id}
        roster={roster}
        buses={returnBuses ?? []}
        countByBus={countByBus}
        independentCount={independentCount}
        withdrawnCount={withdrawnCount}
      />
    </div>
  );
}
