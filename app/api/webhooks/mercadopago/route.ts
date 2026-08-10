import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyMercadoPagoSignature } from "@/lib/mercadopago/verifyWebhookSignature";

export const runtime = "nodejs";

interface MpPayment {
  id: number;
  status: string;
  external_reference: string | null;
  transaction_amount: number | null;
}

async function fetchPayment(paymentId: string): Promise<MpPayment | null> {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as MpPayment;
}

// Mercado Pago espera un 200 rápido. Todo el trabajo de este handler es
// liviano (una llamada a la API de Pagos + una escritura atómica vía RPC),
// así que no hace falta encolar nada aparte para cumplir ese contrato.
export async function POST(request: Request) {
  const url = new URL(request.url);
  const bodyText = await request.text();
  let body: Record<string, unknown> = {};
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    // cuerpo no-JSON: se ignora, igual queda logueado más abajo
  }

  const xSignature = request.headers.get("x-signature");
  const xRequestId = request.headers.get("x-request-id");
  const dataId =
    url.searchParams.get("data.id") ??
    (body?.data as { id?: string } | undefined)?.id ??
    null;

  const signatureValid = verifyMercadoPagoSignature({
    xSignature,
    xRequestId,
    dataId,
    secret: process.env.MP_WEBHOOK_SECRET ?? "",
  });

  const supabase = createAdminClient();

  let processingError: string | null = null;

  if (!signatureValid) {
    processingError = "firma inválida";
  } else {
    const type = (body.type as string | undefined) ?? url.searchParams.get("type");
    if (type === "payment" && dataId) {
      try {
        const payment = await fetchPayment(String(dataId));
        if (!payment) {
          processingError = "no se pudo obtener el pago desde la API de Mercado Pago";
        } else if (!payment.external_reference) {
          processingError = "el pago no tiene external_reference";
        } else {
          const { error } = await supabase.rpc("confirm_payment", {
            p_mp_payment_id: String(payment.id),
            p_mp_preference_id: null,
            p_registration_id: payment.external_reference,
            p_status: mapMpStatus(payment.status),
            p_amount: payment.transaction_amount,
            p_raw: payment,
          });
          if (error) processingError = error.message;
        }
      } catch (err) {
        processingError = err instanceof Error ? err.message : "error desconocido";
      }
    }
    // otros topics (merchant_order, etc.) se reconocen pero no requieren acción
  }

  await supabase.from("mp_webhook_log").insert({
    signature_valid: signatureValid,
    body,
    headers: Object.fromEntries(request.headers.entries()),
    processing_error: processingError,
  });

  if (!signatureValid) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // Siempre 200 salvo firma inválida: reintentar un evento ya procesado (o uno
  // que falló por una causa transitoria) es seguro gracias a la RPC idempotente.
  return NextResponse.json({ received: true });
}

function mapMpStatus(
  status: string,
): "created" | "pending" | "approved" | "rejected" | "refunded" | "cancelled" {
  switch (status) {
    case "approved":
      return "approved";
    case "pending":
    case "in_process":
      return "pending";
    case "rejected":
      return "rejected";
    case "refunded":
    case "charged_back":
      return "refunded";
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}
