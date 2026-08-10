import "server-only";
import crypto from "node:crypto";

// Implementa la validación de firma documentada por Mercado Pago para
// notificaciones webhook: https://www.mercadopago.com.ar/developers -> "Cómo
// validar la notificación". El manifest se arma con el id del recurso (de la
// query string), el request-id y el timestamp, todos provistos por MP.
export function verifyMercadoPagoSignature({
  xSignature,
  xRequestId,
  dataId,
  secret,
}: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string;
}): boolean {
  if (!xSignature || !xRequestId || !dataId || !secret) return false;

  const parts: Record<string, string> = {};
  for (const part of xSignature.split(",")) {
    const [key, value] = part.split("=");
    if (key && value) parts[key.trim()] = value.trim();
  }

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(v1, "hex");
  if (expectedBuf.length !== receivedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}
