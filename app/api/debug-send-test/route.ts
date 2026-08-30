import { NextResponse } from "next/server";
import dns from "node:dns/promises";
import nodemailer from "nodemailer";

// Endpoint temporal de diagnóstico — borrar después de usarlo.
export async function GET() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    return NextResponse.json({ error: "Falta GMAIL_USER/GMAIL_APP_PASSWORD" }, { status: 500 });
  }

  let host = "smtp.gmail.com";
  try {
    const { address } = await dns.lookup("smtp.gmail.com", { family: 4 });
    host = address;
  } catch {}

  const transporter = nodemailer.createTransport({
    host,
    port: 465,
    secure: true,
    tls: { servername: "smtp.gmail.com" },
    auth: { user, pass },
  });

  // "to" con +alias de Gmail para simular un destinatario distinto (pero que
  // sigue llegando a la misma casilla, así podemos revisar el resultado sin
  // necesitar otra cuenta de test).
  const toAddress = user.replace("@gmail.com", "+debugtest@gmail.com");

  try {
    const info = await transporter.sendMail({
      from: `"Grupo de Apoyo Luján - Parroquia San Isidro Labrador" <${user}>`,
      to: toAddress,
      bcc: user,
      subject: "[debug] test de copia BCC",
      text: "Este es un email de prueba para diagnosticar si la copia BCC llega. Se puede borrar.",
    });
    return NextResponse.json({
      to: toAddress,
      bcc: user,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
      messageId: info.messageId,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
