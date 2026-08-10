import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventRow } from "@/lib/types";

export const runtime = "nodejs";

// Pensado para correr diariamente vía Vercel Cron (ver vercel.json).
// Protegido con CRON_SECRET para que no sea un endpoint público invocable
// por cualquiera.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("status", "open")
    .returns<EventRow[]>();

  let totalExpired = 0;
  for (const event of events ?? []) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - event.pending_payment_expiry_days);

    const { data, error } = await supabase
      .from("registrations")
      .update({ status: "expired" })
      .eq("event_id", event.id)
      .eq("status", "pending_payment")
      .lt("created_at", cutoff.toISOString())
      .select("id");

    if (!error) totalExpired += data?.length ?? 0;
  }

  return NextResponse.json({ expired: totalExpired });
}
