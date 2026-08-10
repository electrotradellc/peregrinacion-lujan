import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Único punto de acceso de lectura a las fotos de DNI / carnet de obra
// social. Solo admin, y siempre vía URL firmada de corta duración —
// ninguna sesión de cliente (ni siquiera de admin) tiene acceso directo al
// bucket privado `registration-documents`.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await getSessionProfile();
  if (!session || session.profile.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { path } = await params;
  const objectPath = path.join("/");

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from("registration-documents")
    .createSignedUrl(objectPath, 60);

  if (error || !data) {
    return NextResponse.json({ error: "No se encontró el archivo" }, { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl);
}
