import "server-only";
import { Preference } from "mercadopago";
import { getMercadoPagoClient } from "./client";

function siteUrl() {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url) throw new Error("Falta configurar NEXT_PUBLIC_SITE_URL");
  return url.replace(/\/$/, "");
}

// Crea una preferencia de Checkout Pro. Server-side únicamente — nunca se usa
// MP_ACCESS_TOKEN ni esta función desde el cliente. El pago en sí ocurre
// enteramente en la página hospedada de Mercado Pago (init_point); esta app
// nunca ve ni maneja datos de tarjeta.
export async function createRegistrationPreference(params: {
  registrationId: string;
  eventName: string;
  amount: number;
  payerEmail: string;
}): Promise<{ preferenceId: string; initPoint: string }> {
  const client = getMercadoPagoClient();
  const preference = new Preference(client);
  const base = siteUrl();

  const result = await preference.create({
    body: {
      items: [
        {
          id: params.registrationId,
          title: params.eventName,
          quantity: 1,
          unit_price: params.amount,
          currency_id: "ARS",
        },
      ],
      payer: { email: params.payerEmail },
      external_reference: params.registrationId,
      back_urls: {
        success: `${base}/registro/resultado`,
        failure: `${base}/registro/resultado`,
        pending: `${base}/registro/resultado`,
      },
      auto_return: "approved",
      notification_url: `${base}/api/webhooks/mercadopago`,
      statement_descriptor: "PEREGRINACION",
    },
  });

  if (!result.id || !result.init_point) {
    throw new Error("Mercado Pago no devolvió una preferencia válida");
  }

  return { preferenceId: result.id, initPoint: result.init_point };
}
