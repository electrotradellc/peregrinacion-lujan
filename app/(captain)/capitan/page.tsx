import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusCaptain } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { BusCaptainAssignmentRow, EventRow, BusRow } from "@/lib/types";

export default async function CaptainIndexPage() {
  const session = await requireBusCaptain();
  const supabase = await createClient();

  const { data: assignments } = await supabase
    .from("bus_captain_assignments")
    .select("*")
    .eq("profile_id", session.userId)
    .returns<BusCaptainAssignmentRow[]>();

  if (!assignments || assignments.length === 0) {
    return (
      <p className="text-sm text-neutral-600">
        Todavía no tenés un micro asignado. Contactate con el organizador.
      </p>
    );
  }

  if (assignments.length === 1) {
    redirect(`/capitan/${assignments[0].event_id}`);
  }

  const eventIds = assignments.map((a) => a.event_id);
  const busIds = assignments.map((a) => a.bus_id);
  const [{ data: events }, { data: buses }] = await Promise.all([
    supabase.from("events").select("*").in("id", eventIds).returns<EventRow[]>(),
    supabase.from("buses").select("*").in("id", busIds).returns<BusRow[]>(),
  ]);

  return (
    <ul className="space-y-2">
      {assignments.map((a) => {
        const event = events?.find((e) => e.id === a.event_id);
        const bus = buses?.find((b) => b.id === a.bus_id);
        return (
          <li key={a.id}>
            <Link
              href={`/capitan/${a.event_id}`}
              className="block rounded-md border border-neutral-200 bg-white px-4 py-3 hover:bg-neutral-50"
            >
              {event?.name} — Micro {bus?.bus_number}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
