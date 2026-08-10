import { createClient } from "@/lib/supabase/server";
import type { RegistrationRow, BusRow, StartingPointRow, BusAssignmentRow } from "@/lib/types";
import { BusAssignmentBoard } from "@/components/admin/BusAssignmentBoard";

export default async function AsignacionIdaPage({
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
        .eq("direction", "outbound")
        .returns<BusAssignmentRow[]>(),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Asignación de micros — Ida</h1>
        <p className="text-sm text-neutral-600">
          Cada peregrino solo puede asignarse a un micro de su mismo punto de partida.
        </p>
      </div>
      <BusAssignmentBoard
        eventId={id}
        direction="outbound"
        registrations={registrations ?? []}
        buses={buses ?? []}
        startingPoints={startingPoints ?? []}
        assignments={assignments ?? []}
        showCopyFromOutbound={false}
      />
    </div>
  );
}
