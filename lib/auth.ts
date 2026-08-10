import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/types";

export interface SessionProfile {
  userId: string;
  email: string | null;
  profile: ProfileRow;
}

// Resuelve el usuario logueado + su fila de `profiles` (rol, whatsapp, etc).
// Devuelve null si no hay sesión. La verdad de autorización sigue siendo RLS
// en la base — esto es solo para decidir qué UI renderizar server-side.
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return { userId: user.id, email: user.email ?? null, profile: profile as ProfileRow };
}

export async function requireAdmin(): Promise<SessionProfile> {
  const session = await getSessionProfile();
  if (!session || session.profile.role !== "admin") {
    redirect("/login?error=admin_required");
  }
  return session;
}

export async function requireBusCaptain(): Promise<SessionProfile> {
  const session = await getSessionProfile();
  if (!session || session.profile.role !== "bus_captain") {
    redirect("/login?error=captain_required");
  }
  return session;
}
