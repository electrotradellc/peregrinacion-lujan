import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/types";

// Endpoint temporal de diagnóstico — borrar después de usarlo.
export async function GET() {
  const supabase = await createClient();
  const { data, error, status, statusText } = await supabase
    .from("events")
    .select("*")
    .eq("status", "open")
    .order("event_date", { ascending: true })
    .limit(1)
    .maybeSingle<EventRow>();

  return NextResponse.json({
    hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    data,
    error,
    status,
    statusText,
  });
}
