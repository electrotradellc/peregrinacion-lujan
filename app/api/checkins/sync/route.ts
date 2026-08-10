import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface IncomingCheckin {
  id: string;
  registrationId: string;
  busId: string;
  stopId: string;
  direction: "outbound" | "return";
  eventType: "arrival" | "departure";
  recordedAt: string;
  deviceId: string;
  clientCreatedAt: string;
}

// Idempotente por partida doble:
//  1. `id` es la primary key (generada en el cliente) -> conflicto = ya
//     sincronizado antes, no-op.
//  2. el constraint único de negocio (registration_id, bus_id, stop_id,
//     direction, event_type) -> conflicto = el mismo hecho ya quedó
//     registrado con otro `id` (ej. reinstalación de la app), también no-op.
// En ambos casos el checkin se considera "aceptado": el cliente puede
// marcarlo como sincronizado y dejar de reintentarlo.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { checkins } = (await request.json()) as { checkins: IncomingCheckin[] };
  if (!Array.isArray(checkins)) {
    return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
  }

  const acceptedIds: string[] = [];

  for (const c of checkins) {
    const { error } = await supabase.from("attendance_checkins").insert({
      id: c.id,
      registration_id: c.registrationId,
      bus_id: c.busId,
      stop_id: c.stopId,
      direction: c.direction,
      event_type: c.eventType,
      recorded_at: c.recordedAt,
      recorded_by: user.id,
      device_id: c.deviceId,
      client_created_at: c.clientCreatedAt,
    });

    if (!error) {
      acceptedIds.push(c.id);
      continue;
    }
    // 23505 = unique_violation (por `id` o por la clave de negocio) -> ya
    // estaba, lo tratamos como éxito. Cualquier otro error (ej. RLS porque el
    // capitán no es dueño de ese micro) sí queda sin sincronizar.
    if (error.code === "23505") {
      acceptedIds.push(c.id);
    }
  }

  return NextResponse.json({ acceptedIds });
}
