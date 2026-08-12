import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusCaptain } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  BusCaptainAssignmentRow,
  StopRow,
  BusRow,
  CaptainRosterRow,
  AssignmentDirection,
} from "@/lib/types";
import { AttendanceTable } from "@/components/attendance/AttendanceTable";

export default async function CaptainAsistenciaPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ direction?: string; stopId?: string }>;
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

  const direction: AssignmentDirection = sp.direction === "return" ? "return" : "outbound";
  const lastStop = stops[stops.length - 1];
  // En Vuelta solo se embarca en Luján (última parada) — no hay otras opciones.
  const stopId =
    direction === "return"
      ? lastStop.id
      : sp.stopId && stops.some((s) => s.id === sp.stopId)
        ? sp.stopId
        : stops[0].id;
  const busId = assignment.bus_id;

  const [{ data: rosterRaw }, { data: checkinsAtStop }, { data: supportCheckins }] = await Promise.all([
    supabase.rpc("get_captain_roster", { p_bus_id: busId, p_direction: direction }),
    supabase
      .from("attendance_checkins")
      .select("*")
      .eq("bus_id", busId)
      .eq("direction", direction)
      .eq("stop_id", stopId),
    supabase
      .from("attendance_checkins")
      .select("registration_id")
      .eq("bus_id", busId)
      .eq("direction", direction)
      .eq("event_type", "support_vehicle"),
  ]);
  const roster = ((rosterRaw ?? []) as CaptainRosterRow[]).map((r) => ({
    registrationId: r.registration_id,
    busId,
    busNumber: bus?.bus_number ?? 0,
    pilgrimCode: r.pilgrim_code,
    lastName: r.last_name,
    firstName: r.first_name,
    phone: r.phone,
  }));

  const linkTo = (overrides: Record<string, string>) => {
    const params = new URLSearchParams({ direction, stopId, ...overrides });
    return `/capitan/${eventId}/asistencia?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Asistencia — Micro {bus?.bus_number}</h1>
      <p className="text-xs text-neutral-500">
        Esta planilla necesita conexión. Si no tenés señal, usá{" "}
        <Link href={`/capitan/${eventId}`} className="underline">
          la app de registro sin conexión
        </Link>
        .
      </p>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href={linkTo({ direction: "outbound" })}
          className={`rounded-md px-3 py-1.5 ${direction === "outbound" ? "bg-brand-ink text-white" : "border border-neutral-300"}`}
        >
          Ida
        </Link>
        <Link
          href={linkTo({ direction: "return" })}
          className={`rounded-md px-3 py-1.5 ${direction === "return" ? "bg-brand-ink text-white" : "border border-neutral-300"}`}
        >
          Vuelta
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {(direction === "return" ? [lastStop] : stops).map((s) => (
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
