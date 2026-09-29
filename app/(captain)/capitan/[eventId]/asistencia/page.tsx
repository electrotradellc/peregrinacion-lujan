import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusCaptain } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  BusCaptainAssignmentRow,
  StopRow,
  BusRow,
  CaptainRosterRow,
  AttendanceCheckinRow,
} from "@/lib/types";
import { AttendanceTable } from "@/components/attendance/AttendanceTable";
import { OfflineModeBanner } from "@/components/captain/OfflineModeBanner";

// Pantalla principal del referente al loguearse. Solo Ida: la Vuelta la
// maneja la organización desde Admin → Menú → Vuelta.
export default async function CaptainAsistenciaPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ stopId?: string }>;
}) {
  const { eventId } = await params;
  const sp = await searchParams;
  const session = await requireBusCaptain();
  const supabase = await createClient();

  const { data: assignment } = await supabase
    .from("bus_captain_assignments")
    .select("*")
    .eq("profile_id", session.userId)
    .eq("event_id", eventId)
    .maybeSingle<BusCaptainAssignmentRow>();

  if (!assignment) notFound();

  const [{ data: bus }, { data: stops }] = await Promise.all([
    supabase.from("buses").select("*").eq("id", assignment.bus_id).single<BusRow>(),
    supabase.from("stops").select("*").eq("event_id", eventId).order("sequence_order").returns<StopRow[]>(),
  ]);

  if (!stops?.length) {
    return <p className="text-sm text-neutral-500">Todavía no hay paradas configuradas.</p>;
  }

  const direction = "outbound" as const;
  const lastStop = stops[stops.length - 1];
  const stopId = sp.stopId && stops.some((s) => s.id === sp.stopId) ? sp.stopId : stops[0].id;
  const busId = assignment.bus_id;

  // Todas las marcas de ida del micro (no solo las de esta parada): además
  // de la tabla, se copian al celular para el modo sin conexión.
  const [{ data: rosterRaw }, { data: allCheckinsRaw }] = await Promise.all([
    supabase.rpc("get_captain_roster", { p_bus_id: busId, p_direction: direction }),
    supabase
      .from("attendance_checkins")
      .select("*")
      .eq("bus_id", busId)
      .eq("direction", direction)
      .returns<AttendanceCheckinRow[]>(),
  ]);
  const fullRoster = (rosterRaw ?? []) as CaptainRosterRow[];
  const allCheckins = allCheckinsRaw ?? [];
  const checkinsAtStop = allCheckins.filter((c) => c.stop_id === stopId);
  const supportCheckins = allCheckins.filter((c) => c.event_type === "support_vehicle");
  const roster = fullRoster.map((r) => ({
    registrationId: r.registration_id,
    busId,
    busNumber: bus?.bus_number ?? 0,
    pilgrimCode: r.pilgrim_code,
    lastName: r.last_name,
    firstName: r.first_name,
    phone: r.phone,
    joinsIndependently: r.joins_independently,
  }));

  const linkTo = (overrides: Record<string, string>) => {
    const params = new URLSearchParams({ stopId, ...overrides });
    return `/capitan/${eventId}/asistencia?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Asistencia — Micro {bus?.bus_number}</h1>
      <OfflineModeBanner
        eventId={eventId}
        busId={busId}
        roster={fullRoster}
        checkins={allCheckins}
      />

      <div className="flex flex-wrap gap-2 text-sm">
        {stops.map((s) => (
          <Link
            key={s.id}
            href={linkTo({ stopId: s.id })}
            className={`rounded-md px-3 py-1.5 ${s.id === stopId ? "bg-brand-ink text-white" : "border border-neutral-300"}`}
          >
            {s.sequence_order}. {s.name}
          </Link>
        ))}
      </div>

      <AttendanceTable
        eventId={eventId}
        direction={direction}
        stopId={stopId}
        roster={roster}
        checkinsAtStop={checkinsAtStop.map((c) => ({
          id: c.id,
          registrationId: c.registration_id,
          eventType: c.event_type,
          recordedAt: c.recorded_at,
        }))}
        supportVehicleCheckins={supportCheckins.map((c) => ({
          id: c.id,
          registrationId: c.registration_id,
          eventType: "support_vehicle" as const,
          recordedAt: c.recorded_at,
        }))}
        isPresentationStop={stops.find((s) => s.id === stopId)?.is_presentation_stop ?? false}
        isFinalStop={stopId === lastStop.id}
      />
    </div>
  );
}
