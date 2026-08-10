"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AssignmentDirection, CheckinEventType } from "@/lib/types";

// Marca online (a diferencia de la cola offline de /capitan): pensada para
// cuando hay señal, ya sea el admin mirando la planilla o un capitán en una
// parada con conexión. Reutiliza attendance_checkins con las mismas reglas
// de idempotencia — tocar el mismo botón dos veces no duplica nada, y RLS
// sigue siendo quien decide si el capitán puede escribir en ese micro.
export async function recordAttendanceAction(params: {
  eventId: string;
  busId: string;
  direction: AssignmentDirection;
  stopId: string;
  registrationId: string;
  eventType: CheckinEventType;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");

  const now = new Date().toISOString();
  const { error } = await supabase.from("attendance_checkins").insert({
    id: crypto.randomUUID(),
    registration_id: params.registrationId,
    bus_id: params.busId,
    stop_id: params.stopId,
    direction: params.direction,
    event_type: params.eventType,
    recorded_at: now,
    recorded_by: user.id,
    device_id: "web-online",
    client_created_at: now,
  });

  // 23505 = ya estaba marcado — no-op, no es un error real para quien mira.
  if (error && error.code !== "23505") throw new Error(error.message);

  revalidatePath(`/admin/eventos/${params.eventId}/asistencia`);
  revalidatePath(`/capitan/${params.eventId}/asistencia`);
}

// Se usa en la parada de presentación (la Parroquia): si alguien no se
// presenta, lo saca de circulación igual que una cancelación normal — deja
// de aparecer en Inscripciones, asignación de micros y el resto de las
// paradas. RLS permite esto tanto a admin como al capitán del micro de ida
// de esa persona (ver migración registrations_captain_mark_no_show).
export async function markNoShowAction(eventId: string, registrationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");

  const { error } = await supabase
    .from("registrations")
    .update({ status: "cancelled" })
    .eq("id", registrationId);
  if (error) throw new Error(error.message);

  await supabase.from("event_audit_log").insert({
    event_id: eventId,
    actor_id: user.id,
    action: "registration_no_show",
    entity_table: "registrations",
    entity_id: registrationId,
  });

  revalidatePath(`/admin/eventos/${eventId}/asistencia`);
  revalidatePath(`/admin/eventos/${eventId}/inscripciones`);
  revalidatePath(`/capitan/${eventId}/asistencia`);
}
