import { createClient } from "@/lib/supabase/server";
import type { BusRow, StopRow, AttendanceCheckinRow } from "@/lib/types";
import { AttendanceDashboard } from "@/components/admin/AttendanceDashboard";

export default async function AsistenciaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: buses }, { data: stops }] = await Promise.all([
    supabase.from("buses").select("*").eq("event_id", id).order("bus_number").returns<BusRow[]>(),
    supabase.from("stops").select("*").eq("event_id", id).order("sequence_order").returns<StopRow[]>(),
  ]);

  const busIds = (buses ?? []).map((b) => b.id);
  const { data: checkins } = await supabase
    .from("attendance_checkins")
    .select("*")
    .in("bus_id", busIds.length ? busIds : ["00000000-0000-0000-0000-000000000000"])
    .returns<AttendanceCheckinRow[]>();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Asistencia en vivo</h1>
      <AttendanceDashboard buses={buses ?? []} stops={stops ?? []} initialCheckins={checkins ?? []} />
    </div>
  );
}
