import { createClient } from "@/lib/supabase/server";
import type { BusAssignmentRow, BusRow, RegistrationRow, ReturnBusRow } from "@/lib/types";
import { VueltaView } from "@/components/admin/VueltaView";
import type { ReturnAssignedPerson, ReturnPerson } from "@/components/admin/returnTypes";

type AssignedRow = {
  registration_id: string;
  return_bus_id: string;
  registrations: Pick<
    RegistrationRow,
    "pilgrim_code" | "last_name" | "first_name" | "phone" | "returns_independently"
  >;
};

// Vuelta: la lista de pendientes es la de la Ida (confirmados con micro de ida)
// menos quienes vuelven por su cuenta, quienes se retiraron y quienes ya tienen
// micro de vuelta. Los micros de vuelta son una lista propia; asignar a alguien
// a uno es darle el "boleto". No se exige que haya marcado llegada a Luján.
export default async function VueltaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: buses }, { data: returnBuses }] = await Promise.all([
    supabase.from("buses").select("*").eq("event_id", id).returns<BusRow[]>(),
    supabase
      .from("return_buses")
      .select("*")
      .eq("event_id", id)
      .order("bus_number")
      .returns<ReturnBusRow[]>(),
  ]);

  if (!buses?.length) {
    return (
      <p className="text-sm text-neutral-500">Configurá al menos un micro antes de organizar la vuelta.</p>
    );
  }

  const busIds = buses.map((b) => b.id);
  const returnBusIds = (returnBuses ?? []).map((b) => b.id);

  const [{ data: outbound }, { data: withdrawnRows }, { data: returnAssignments }] = await Promise.all([
    supabase
      .from("bus_assignments")
      .select("*, registrations!inner(*)")
      .in("bus_id", busIds)
      .eq("direction", "outbound")
      .eq("registrations.status", "confirmed")
      .returns<(BusAssignmentRow & { registrations: RegistrationRow })[]>(),
    supabase.from("attendance_checkins").select("registration_id").in("bus_id", busIds).eq("event_type", "withdrawn"),
    returnBusIds.length
      ? supabase
          .from("return_assignments")
          .select("registration_id, return_bus_id, registrations(pilgrim_code, last_name, first_name, phone, returns_independently)")
          .in("return_bus_id", returnBusIds)
          .returns<AssignedRow[]>()
      : Promise.resolve({ data: [] as AssignedRow[] }),
  ]);

  const withdrawnIds = new Set((withdrawnRows ?? []).map((w) => w.registration_id));
  const assignedIds = new Set((returnAssignments ?? []).map((a) => a.registration_id));

  const countByBus: Record<string, number> = {};
  for (const a of returnAssignments ?? []) {
    countByBus[a.return_bus_id] = (countByBus[a.return_bus_id] ?? 0) + 1;
  }

  // Quienes tienen micro de vuelta (aunque después hayan pasado a "vuelve por
  // su cuenta"): se listan por micro para poder corregirlos.
  const assigned: ReturnAssignedPerson[] = (returnAssignments ?? []).map((a) => ({
    registrationId: a.registration_id,
    pilgrimCode: a.registrations.pilgrim_code,
    lastName: a.registrations.last_name,
    firstName: a.registrations.first_name,
    phone: a.registrations.phone,
    returnBusId: a.return_bus_id,
    returnsIndependently: a.registrations.returns_independently,
  }));

  const independentCount = (outbound ?? []).filter((a) => a.registrations.returns_independently).length;
  const withdrawnCount = (outbound ?? []).filter(
    (a) => !a.registrations.returns_independently && withdrawnIds.has(a.registration_id),
  ).length;

  const pending: ReturnPerson[] = (outbound ?? [])
    .filter(
      (a) =>
        !a.registrations.returns_independently &&
        !withdrawnIds.has(a.registration_id) &&
        !assignedIds.has(a.registration_id),
    )
    .map((a) => ({
      registrationId: a.registration_id,
      pilgrimCode: a.registrations.pilgrim_code,
      lastName: a.registrations.last_name,
      firstName: a.registrations.first_name,
      phone: a.registrations.phone,
    }));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Vuelta</h1>

      <VueltaView
        eventId={id}
        buses={returnBuses ?? []}
        countByBus={countByBus}
        pending={pending}
        assigned={assigned}
        independentCount={independentCount}
        withdrawnCount={withdrawnCount}
      />
    </div>
  );
}
