import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

interface MpSearchResult {
  results: Array<{
    id: number;
    status: string;
    external_reference: string | null;
    transaction_amount: number | null;
  }>;
}

// Red de seguridad manual para el caso raro en que un webhook nunca llegó:
// el admin dispara esto desde /admin/eventos/[id]/pagos para una inscripción
// puntual que sigue en pending_payment.
export async function POST(request: Request) {
  const session = await getSessionProfile();
  if (!session || session.profile.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { registrationId } = await request.json();
  if (!registrationId) {
    return NextResponse.json({ error: "Falta registrationId" }, { status: 400 });
  }

  const res = await fetch(
    `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(registrationId)}`,
    { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } },
  );
  if (!res.ok) {
    return NextResponse.json({ error: "No pudimos consultar Mercado Pago" }, { status: 502 });
  }
  const { results } = (await res.json()) as MpSearchResult;

  const approved = results.find((p) => p.status === "approved");
  if (!approved) {
    return NextResponse.json({ found: false, results });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.rpc("confirm_payment", {
    p_mp_payment_id: String(approved.id),
    p_mp_preference_id: null,
    p_registration_id: registrationId,
    p_status: "approved",
    p_amount: approved.transaction_amount,
    p_raw: approved,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ found: true, confirmed: true });
}
