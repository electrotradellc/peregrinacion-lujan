import { notFound } from "next/navigation";
import { requireBusCaptain } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { BusCaptainAssignmentRow, StopRow, BusRow, CaptainRosterRow } from "@/lib/types";
import { CaptainApp } from "@/components/captain/CaptainApp";

export default async function CaptainEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const session = await requireBusCaptain();
  const supabase = await createClient();

  const { data: assignment } = await supabase
    .from("bus_captain_assignments")
    .select("*")
    .eq("profile_id", session.userId)
    .eq("event_id", eventId)
    .maybeSingle<BusCaptainAssignmentRow>();

  if (!assignment) notFound();

  const { data: bus } = await supabase
    .from("buses")
    .select("*")
    .eq("id", assignment.bus_id)
    .single<BusRow>();

  const { data: stops } = await supabase
    .from("stops")
    .select("*")
    .eq("event_id", eventId)
    .order("sequence_order")
    .returns<StopRow[]>();

  // Modo sin conexión del referente — solo Ida (la Vuelta es de Admin).
  const { data: outboundRosterRaw } = await supabase.rpc("get_captain_roster", {
    p_bus_id: assignment.bus_id,
    p_direction: "outbound",
  });

  return (
    <CaptainApp
      eventId={eventId}
      busId={assignment.bus_id}
      busNumber={bus?.bus_number ?? 0}
      recordedBy={session.userId}
      stops={stops ?? []}
      initialRoster={(outboundRosterRaw ?? []) as CaptainRosterRow[]}
    />
  );
}
