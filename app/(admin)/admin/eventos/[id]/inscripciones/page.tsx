import { createClient } from "@/lib/supabase/server";
import type { RegistrationRow, StartingPointRow, BusRow, BusAssignmentRow, EventRow } from "@/lib/types";
import { InscripcionesTable } from "@/components/admin/InscripcionesTable";
import { statusLabel, statusClass } from "@/lib/registrationStatus";
import { confirmBusAssignmentsAction, reopenBusAssignmentsAction } from "./actions";

export default async function InscripcionesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: event }, { data: startingPoints }, { data: buses }, { data: registrationsRaw }] =
    await Promise.all([
      supabase.from("events").select("*").eq("id", id).single<EventRow>(),
      supabase.from("starting_points").select("*").eq("event_id", id).returns<StartingPointRow[]>(),
      supabase.from("buses").select("*").eq("event_id", id).order("bus_number").returns<BusRow[]>(),
      supabase.from("registrations").select("*").eq("event_id", id).returns<RegistrationRow[]>(),
    ]);

  const registrations = registrationsRaw ?? [];
  const statusCounts = Object.keys(statusLabel).reduce<Record<string, number>>((acc, status) => {
    acc[status] = registrations.filter((r) => r.status === status).length;
    return acc;
  }, {});
  const totalCount = registrations.length;
  const startingPointCounts = (startingPoints ?? []).map((sp) => ({
    id: sp.id,
    name: sp.name,
    count: registrations.filter((r) => r.starting_point_id === sp.id).length,
  }));
  const independentJoinersCount = registrations.filter((r) => r.joins_independently).length;

  const busIds = (buses ?? []).map((b) => b.id);
  const { data: assignmentsRaw } = busIds.length
    ? await supabase.from("bus_assignments").select("*").in("bus_id", busIds).returns<BusAssignmentRow[]>()
    : { data: [] as BusAssignmentRow[] };
  const assignments = assignmentsRaw ?? [];

  const unassignedConfirmedCount = registrations.filter(
    (r) =>
      r.status === "confirmed" &&
      !assignments.some((a) => a.registration_id === r.id && a.direction === "outbound"),
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Inscripciones</h1>
        <a
          href={`/api/registrations/export?eventId=${id}`}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100"
        >
          Exportar CSV
        </a>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-neutral-100 px-3 py-1 font-medium text-neutral-700">
          Total: {totalCount}
        </span>
        {Object.entries(statusLabel).map(([status, label]) => (
          <span
            key={status}
            className={`rounded-full px-3 py-1 font-medium ${statusClass[status]}`}
          >
            {label}: {statusCounts[status] ?? 0}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {startingPointCounts.map((sp) => (
          <span
            key={sp.id}
            className="rounded-full bg-brand/30 px-3 py-1 font-medium text-brand-ink"
          >
            {sp.name}: {sp.count}
          </span>
        ))}
        <span className="rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-800">
          Se unen por su cuenta: {independentJoinersCount}
        </span>
      </div>

      {event?.bus_assignments_confirmed_at ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-green-50 px-4 py-2 text-sm text-green-800">
          <span>
            ✓ Asignación de micros confirmada el{" "}
            {new Date(event.bus_assignments_confirmed_at).toLocaleString("es-AR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "America/Argentina/Buenos_Aires",
            })}
            . Los inscriptos ya pueden ver su micro y contactar a su capitán en /mi-inscripcion.
          </span>
          <form action={reopenBusAssignmentsAction.bind(null, id)}>
            <button className="rounded-md border border-green-300 px-3 py-1 text-xs font-medium hover:bg-green-100">
              Reabrir asignación
            </button>
          </form>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <span>
            La asignación de micros todavía no está confirmada — los inscriptos no ven su micro
            ni pueden contactar a su capitán hasta que confirmes.
            {unassignedConfirmedCount > 0 && (
              <> Hay {unassignedConfirmedCount} confirmado{unassignedConfirmedCount === 1 ? "" : "s"} sin micro de ida asignado.</>
            )}
          </span>
          <form action={confirmBusAssignmentsAction.bind(null, id)}>
            <button className="rounded-md bg-brand-ink px-3 py-1.5 text-xs font-semibold text-white">
              Confirmar asignación de micros
            </button>
          </form>
        </div>
      )}

      <InscripcionesTable
        eventId={id}
        registrations={registrations}
        startingPoints={startingPoints ?? []}
        buses={buses ?? []}
        assignments={assignments}
        eventDate={event?.event_date}
      />
    </div>
  );
}
