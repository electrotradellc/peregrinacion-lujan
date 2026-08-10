import "server-only";
import dns from "node:dns/promises";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

// Los mails salen directo desde la casilla de Gmail de la parroquia (no un
// proveedor transaccional con dominio propio) — así las respuestas de los
// peregrinos caen naturalmente en esa misma casilla, sin configurar DNS.
//
// Nodemailer hace su propia resolución DNS internamente y en algunas redes
// termina prefiriendo una dirección IPv6 de smtp.gmail.com a la que la
// máquina no tiene ruta (ECONNREFUSED). Para evitarlo, resolvemos nosotros
// mismos una IP v4 y conectamos directo a esa IP, fijando `servername` para
// que la validación del certificado TLS siga validando contra el hostname
// real.
async function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error("Falta configurar GMAIL_USER / GMAIL_APP_PASSWORD");
  }

  let host = "smtp.gmail.com";
  try {
    const { address } = await dns.lookup("smtp.gmail.com", { family: 4 });
    host = address;
  } catch {
    // si falla la resolución manual, dejamos que nodemailer intente con el
    // hostname tal cual (mismo comportamiento que antes de este fix)
  }

  const options: SMTPTransport.Options = {
    host,
    port: 465,
    secure: true,
    tls: { servername: "smtp.gmail.com" },
    auth: { user, pass },
  };
  return nodemailer.createTransport(options);
}

export async function sendEmail(params: { to: string; subject: string; text: string }) {
  const user = process.env.GMAIL_USER;
  if (!user) throw new Error("Falta configurar GMAIL_USER");

  const transporter = await getTransporter();
  await transporter.sendMail({
    from: `"Grupo de Apoyo Luján - Parroquia San Isidro Labrador" <${user}>`,
    to: params.to,
    subject: params.subject,
    text: params.text,
  });
}
