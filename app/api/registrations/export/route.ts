import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { RegistrationRow, StartingPointRow, BusAssignmentRow, BusRow } from "@/lib/types";

export const runtime = "nodejs";

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

// Listado imprimible en papel, el fallback si un celular falla del todo el
// día del evento.
export async function GET(request: Request) {
  const session = await getSessionProfile();
  if (!session || session.profile.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const eventId = new URL(request.url).searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "Falta eventId" }, { status: 400 });
  }

  const supabase = await createClient();
  const [{ data: registrations }, { data: startingPoints }, { data: buses }, { data: assignments }] =
    await Promise.all([
      supabase
        .from("registrations")
        .select("*")
        .eq("event_id", eventId)
        .eq("status", "confirmed")
        .returns<RegistrationRow[]>(),
      supabase.from("starting_points").select("*").eq("event_id", eventId).returns<StartingPointRow[]>(),
      supabase.from("buses").select("*").eq("event_id", eventId).returns<BusRow[]>(),
      supabase
        .from("bus_assignments")
        .select("*")
        .eq("direction", "outbound")
        .returns<BusAssignmentRow[]>(),
    ]);

  const spName = (id: string) => startingPoints?.find((sp) => sp.id === id)?.name ?? "";
  const busNumber = (registrationId: string) => {
    const assignment = assignments?.find((a) => a.registration_id === registrationId);
    if (!assignment) return "";
    return buses?.find((b) => b.id === assignment.bus_id)?.bus_number ?? "";
  };

  const header = [
    "Apellido",
    "Nombre",
    "DNI",
    "Celular",
    "Punto de partida",
    "Micro (ida)",
    "Contacto de emergencia",
    "Celular de emergencia",
    "Alergias",
    "Celiaquía",
    "Diabetes",
    "Hipertensión",
    "Resp.",
    "Cardíaca",
    "Otra",
    "Medicación",
  ];
  const rows = (registrations ?? []).map((r) => [
    r.last_name,
    r.first_name,
    r.dni,
    r.phone,
    spName(r.starting_point_id),
    String(busNumber(r.id)),
    r.emergency_contact_name,
    r.emergency_contact_phone,
    r.has_allergies ? `Sí (${r.allergies_detail ?? ""})` : "No",
    r.has_celiac ? "Sí" : "No",
    r.has_diabetes ? "Sí" : "No",
    r.has_hypertension ? "Sí" : "No",
    r.has_respiratory_condition ? "Sí" : "No",
    r.has_heart_condition ? "Sí" : "No",
    r.has_other_condition ? `Sí (${r.other_condition_detail ?? ""})` : "No",
    r.takes_medication ? `Sí (${r.medication_detail ?? ""})` : "No",
  ]);

  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inscriptos-${eventId}.csv"`,
    },
  });
}
