import "server-only";
import { MercadoPagoConfig } from "mercadopago";

export function getMercadoPagoClient() {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("Falta configurar MP_ACCESS_TOKEN");
  }
  return new MercadoPagoConfig({ accessToken });
}
