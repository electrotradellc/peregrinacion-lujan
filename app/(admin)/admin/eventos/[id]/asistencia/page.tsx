import { createClient } from "@/lib/supabase/server";
import type { BusRow, StopRow, RegistrationRow, BusAssignmentRow, AssignmentDirection } from "@/lib/types";
import { AttendanceTable } from "@/components/attendance/AttendanceTable";
import { AsistenciaSelectors } from "@/components/attendance/AsistenciaSelectors";

export default async function AsistenciaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ busId?: string; direction?: string; stopId?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: buses }, { data: stops }] = await Promise.all([
    supabase.from("buses").select("*").eq("event_id", id).order("bus_number").returns<BusRow[]>(),
    supabase.from("stops").select("*").eq("event_id", id).order("sequence_order").returns<StopRow[]>(),
  ]);

  if (!buses?.length || !stops?.length) {
    return (
      <p className="text-sm text-neutral-500">
        Configurá al menos un micro y una parada antes de tomar asistencia.
      </p>
    );
  }

  const busId = sp.busId === "all" || (sp.busId && buses.some((b) => b.id === sp.busId)) ? sp.busId! : buses[0].id;
  const allBuses = busId === "all";
  const busIds = buses.map((b) => b.id);
  const busNumberById = new Map(buses.map((b) => [b.id, b.bus_number]));
  const direction: AssignmentDirection = sp.direction === "return" ? "return" : "outbound";
  const lastStop = stops[stops.length - 1];
  // En Vuelta solo se embarca en Luján (última parada) — no hay otras opciones.
  const stopId =
    direction === "return"
      ? lastStop.id
      : sp.stopId && stops.some((s) => s.id === sp.stopId)
        ? sp.stopId
        : stops[0].id;

  const [{ data: assignments }, { data: checkinsAtStop }, { data: supportCheckins }] = await Promise.all([
    (allBuses
      ? supabase.from("bus_assignments").select("*, registrations!inner(*)").in("bus_id", busIds)
      : supabase.from("bus_assignments").select("*, registrations!inner(*)").eq("bus_id", busId)
    )
      .eq("direction", direction)
      .eq("registrations.status", "confirmed")
      .returns<(BusAssignmentRow & { registrations: RegistrationRow })[]>(),
    (allBuses
      ? supabase.from("attendance_checkins").select("*").in("bus_id", busIds)
      : supabase.from("attendance_checkins").select("*").eq("bus_id", busId)
    )
      .eq("direction", direction)
      .eq("stop_id", stopId),
    (allBuses
      ? supabase.from("attendance_checkins").select("registration_id").in("bus_id", busIds)
      : supabase.from("attendance_checkins").select("registration_id").eq("bus_id", busId)
    )
      .eq("direction", direction)
      .eq("event_type", "support_vehicle"),
  ]);

  const roster = (assignments ?? []).map((a) => ({
    registrationId: a.registrations.id,
    busId: a.bus_id,
    busNumber: busNumberById.get(a.bus_id) ?? 0,
    pilgrimCode: a.registrations.pilgrim_code,
    lastName: a.registrations.last_name,
    firstName: a.registrations.first_name,
    phone: a.registrations.phone,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{direction === "return" ? "Vuelta" : "Asistencia"}</h1>

      <AsistenciaSelectors
        basePath={`/admin/eventos/${id}/asistencia`}
        direction={direction}
        busId={busId}
        stopId={stopId}
        buses={buses}
        stops={direction === "return" ? [lastStop] : stops}
      />

      <AttendanceTable
        eventId={id}
        direction={direction}
        stopId={stopId}
        roster={roster}
        checkinsAtStop={(checkinsAtStop ?? []).map((c) => ({
          registrationId: c.registration_id,
          eventType: c.event_type,
          recordedAt: c.recorded_at,
        }))}
        supportVehicleRegistrationIds={(supportCheckins ?? []).map((c) => c.registration_id)}
        isPresentationStop={stops.find((s) => s.id === stopId)?.is_presentation_stop ?? false}
        isFinalStop={stopId === lastStop.id}
      />
    </div>
  );
}
