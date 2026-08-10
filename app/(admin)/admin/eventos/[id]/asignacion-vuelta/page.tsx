import { createClient } from "@/lib/supabase/server";
import type { RegistrationRow, BusRow, StartingPointRow, BusAssignmentRow } from "@/lib/types";
import { BusAssignmentBoard } from "@/components/admin/BusAssignmentBoard";

export default async function AsignacionVueltaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: registrations }, { data: buses }, { data: startingPoints }, { data: assignments }] =
    await Promise.all([
      supabase
        .from("registrations")
        .select("*")
        .eq("event_id", id)
        .eq("status", "confirmed")
        .order("last_name")
        .returns<RegistrationRow[]>(),
      supabase.from("buses").select("*").eq("event_id", id).order("bus_number").returns<BusRow[]>(),
      supabase.from("starting_points").select("*").eq("event_id", id).returns<StartingPointRow[]>(),
      supabase
        .from("bus_assignments")
        .select("*")
        .eq("direction", "return")
        .returns<BusAssignmentRow[]>(),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Asignación de micros — Vuelta</h1>
        <p className="text-sm text-neutral-600">
          Puede diferir de la asignación de ida. Usá &quot;Copiar asignación de ida&quot; como
          punto de partida y ajustá lo que haga falta.
        </p>
      </div>
      <BusAssignmentBoard
        eventId={id}
        direction="return"
        registrations={registrations ?? []}
        buses={buses ?? []}
        startingPoints={startingPoints ?? []}
        assignments={assignments ?? []}
        showCopyFromOutbound
      />
    </div>
  );
}
