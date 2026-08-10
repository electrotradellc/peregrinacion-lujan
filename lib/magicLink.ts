import "server-only";
import crypto from "node:crypto";

// Token de solo-lectura para /mi-inscripcion/[registrationId] — el peregrino
// nunca tiene cuenta, así que esto reemplaza el login: quien tenga el link
// completo (con token) puede ver su propia inscripción, y nada más (no se
// puede enumerar otras inscripciones a partir de un registrationId sin el
// token correcto, porque no es una firma predecible/secuencial).
function secret(): string {
  const s = process.env.MAGIC_LINK_SECRET;
  if (!s) throw new Error("Falta configurar MAGIC_LINK_SECRET");
  return s;
}

export function generateMagicToken(registrationId: string): string {
  return crypto.createHmac("sha256", secret()).update(registrationId).digest("hex");
}

export function verifyMagicToken(registrationId: string, token: string | undefined | null): boolean {
  if (!token) return false;
  const expected = Buffer.from(generateMagicToken(registrationId), "hex");
  const received = Buffer.from(token, "hex");
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}

export function magicLinkPath(registrationId: string): string {
  return `/mi-inscripcion/${registrationId}?token=${generateMagicToken(registrationId)}`;
}
