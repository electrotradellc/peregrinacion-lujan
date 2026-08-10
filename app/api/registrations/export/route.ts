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
  const [
    { data: registrations },
    { data: startingPoints },
    { data: buses },
    { data: outboundAssignments },
    { data: returnAssignments },
  ] = await Promise.all([
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
    supabase
      .from("bus_assignments")
      .select("*")
      .eq("direction", "return")
      .returns<BusAssignmentRow[]>(),
  ]);

  const spName = (id: string) => startingPoints?.find((sp) => sp.id === id)?.name ?? "";
  const busNumberFor = (registrationId: string, assignments: BusAssignmentRow[] | null) => {
    const assignment = assignments?.find((a) => a.registration_id === registrationId);
    if (!assignment) return null;
    return buses?.find((b) => b.id === assignment.bus_id)?.bus_number ?? null;
  };

  // Ordenado por micro de ida (los sin asignar al final) y después apellido,
  // para que impreso salga directamente como listado por micro.
  const sorted = [...(registrations ?? [])].sort((a, b) => {
    const busA = busNumberFor(a.id, outboundAssignments);
    const busB = busNumberFor(b.id, outboundAssignments);
    if (busA !== busB) {
      if (busA === null) return 1;
      if (busB === null) return -1;
      return busA - busB;
    }
    return a.last_name.localeCompare(b.last_name, "es");
  });

  const header = [
    "Nro",
    "Apellido",
    "Nombre",
    "DNI",
    "Celular",
    "Punto de partida",
    "Micro (ida)",
    "Micro (vuelta)",
    "Vuelve por su cuenta",
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
    "Fecha de inscripción",
  ];
  const rows = sorted.map((r) => [
    String(r.pilgrim_code ?? ""),
    r.last_name,
    r.first_name,
    r.dni,
    r.phone,
    spName(r.starting_point_id),
    String(busNumberFor(r.id, outboundAssignments) ?? ""),
    String(busNumberFor(r.id, returnAssignments) ?? ""),
    r.returns_independently ? "Sí" : "No",
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
    new Date(r.created_at).toLocaleString("es-AR"),
  ]);

  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inscriptos-${eventId}.csv"`,
    },
  });
}
