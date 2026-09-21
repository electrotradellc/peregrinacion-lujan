import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { waitlistFieldsSchema } from "@/lib/validation/waitlistSchema";
import { sendWaitlistConfirmationEmail } from "@/lib/email/waitlistEmails";
import type { EventRow, StartingPointRow } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = waitlistFieldsSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Revisá los datos del formulario." }, { status: 400 });
  }
  const data = parsed.data;

  const supabase = createAdminClient();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", data.eventId)
    .single<EventRow>();
  if (!event || event.status !== "open") {
    return NextResponse.json(
      { error: "La inscripción para este evento no está disponible." },
      { status: 400 },
    );
  }

  const { data: startingPoint } = await supabase
    .from("starting_points")
    .select("*")
    .eq("id", data.startingPointId)
    .eq("event_id", data.eventId)
    .single<StartingPointRow>();
  if (!startingPoint || !startingPoint.is_active) {
    return NextResponse.json(
      { error: "Ese punto de partida ya no está disponible." },
      { status: 400 },
    );
  }

  const { count: activeRegistrationCount } = await supabase
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", data.eventId)
    .eq("dni", data.dni)
    .in("status", ["pending_payment", "confirmed"]);
  if ((activeRegistrationCount ?? 0) > 0) {
    return NextResponse.json(
      { error: "Ese DNI ya tiene una inscripción activa para este evento." },
      { status: 409 },
    );
  }

  const { error: insertError } = await supabase.from("waitlist_entries").insert({
    event_id: data.eventId,
    starting_point_id: data.startingPointId,
    first_name: data.firstName,
    last_name: data.lastName,
    dni: data.dni,
    phone: data.phone,
    email: data.email,
    status: "waiting",
  });

  if (insertError) {
    const isDuplicate = insertError.code === "23505";
    return NextResponse.json(
      {
        error: isDuplicate
          ? "Ese DNI ya está anotado en la lista de espera para este evento."
          : "No pudimos anotarte en la lista de espera.",
      },
      { status: isDuplicate ? 409 : 500 },
    );
  }

  // Igual que en /api/registrations: el mail es "mejor esfuerzo", no
  // bloquea la anotación si falla el envío.
  try {
    await sendWaitlistConfirmationEmail(data, event, startingPoint);
  } catch (err) {
    console.error("No se pudo enviar el email de confirmación de lista de espera:", err);
  }

  return NextResponse.json({ ok: true });
}
