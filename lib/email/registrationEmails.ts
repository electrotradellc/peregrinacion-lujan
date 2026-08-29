import "server-only";
import { sendEmail } from "./client";
import { renderTemplate } from "./template";
import { magicLinkPath } from "@/lib/magicLink";
import type { RegistrationRow, EventRow, StartingPointRow, BusRow } from "@/lib/types";

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
}

function stripMarkdown(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1");
}

function medicalSummary(r: RegistrationRow): string {
  const lines: string[] = [];
  if (r.has_allergies) lines.push(`Alergias (${r.allergies_detail ?? "sin detalle"})`);
  if (r.has_celiac) lines.push("Celiaquía");
  if (r.has_diabetes) lines.push("Diabetes");
  if (r.has_hypertension) lines.push("Hipertensión");
  if (r.has_respiratory_condition) lines.push("Enfermedad respiratoria");
  if (r.has_heart_condition) lines.push("Enfermedad cardíaca");
  if (r.has_other_condition) lines.push(`Otra (${r.other_condition_detail ?? "sin detalle"})`);
  if (r.takes_medication) lines.push(`Toma medicación (${r.medication_detail ?? "sin detalle"})`);
  return lines.length ? lines.join(", ") : "Ninguna";
}

const SIGNATURE = "Muchas gracias!\nSaludos.\n\nGrupo de Apoyo Luján\nParroquia San Isidro Labrador";

export const REGISTRATION_PENDING_TAGS = [
  "nombre",
  "evento",
  "datos_cargados",
  "monto",
  "instrucciones_pago",
  "contacto_alternativo",
  "link",
  "firma",
] as const;

export const DEFAULT_REGISTRATION_PENDING_TEMPLATE = `Hola {{nombre}}, hemos recibido tu Formulario de Inscripción a la {{evento}}!

Vamos a revisar toda la información y si necesitamos algo más te vamos a contactar por email o WhatsApp.

Estos son los datos que cargaste:
{{datos_cargados}}

Tu inscripción está PENDIENTE hasta que confirmemos el pago.

Si todavía no hiciste el pago, estos son los datos:

VALOR: {{monto}} por peregrino

{{instrucciones_pago}}

Luego de pagar envianos el comprobante respondiendo este email{{contacto_alternativo}}.

Podés ver el estado de tu inscripción en cualquier momento acá: {{link}}

{{firma}}`;

// Se dispara al terminar de inscribirse (registration en pending_payment).
// Confirma la recepción, repite los datos cargados (para que el peregrino
// pueda detectar un error de tipeo) y las instrucciones de pago.
// Separado de sendRegistrationPendingEmail para poder previsualizar el
// texto exacto (Config → Emails automáticos) sin mandar nada de verdad.
export function buildRegistrationPendingEmail(
  registration: RegistrationRow,
  event: EventRow,
  startingPoint: StartingPointRow | null,
): { subject: string; text: string } {
  const link = `${siteUrl()}${magicLinkPath(registration.id)}`;

  const dataSummary = [
    `Nombre y apellido: ${registration.first_name} ${registration.last_name}`,
    `DNI: ${registration.dni}`,
    `Celular: ${registration.phone}`,
    `Email: ${registration.email}`,
    `Fecha de nacimiento: ${registration.birth_date}`,
    `Punto de partida: ${startingPoint?.name ?? "-"}`,
    `Vuelve por sus propios medios: ${registration.returns_independently ? "Sí" : "No"}`,
    `Obra social: ${
      registration.has_health_insurance
        ? `Sí, ${registration.health_insurance_provider ?? "-"} (afiliado ${registration.health_insurance_member_number ?? "-"})`
        : "No"
    }`,
    `Contacto de emergencia: ${registration.emergency_contact_name} - ${registration.emergency_contact_phone}`,
    `Información médica: ${medicalSummary(registration)}`,
  ].join("\n");

  const template = event.email_registration_pending_template || DEFAULT_REGISTRATION_PENDING_TEMPLATE;

  const text = renderTemplate(template, {
    nombre: registration.first_name,
    evento: event.name,
    datos_cargados: dataSummary,
    monto: `$${event.registration_price_ars.toLocaleString("es-AR")}`,
    instrucciones_pago: event.payment_instructions ? stripMarkdown(event.payment_instructions) : "",
    contacto_alternativo: event.contact_email ? ` o a ${event.contact_email}` : "",
    link,
    firma: SIGNATURE,
  });

  return { subject: `Inscripción recibida — ${event.name}`, text };
}

export async function sendRegistrationPendingEmail(
  registration: RegistrationRow,
  event: EventRow,
  startingPoint: StartingPointRow | null,
) {
  const { subject, text } = buildRegistrationPendingEmail(registration, event, startingPoint);
  await sendEmail({ to: registration.email, subject, text });
}

export const PAYMENT_CONFIRMED_TAGS = [
  "nombre",
  "evento",
  "estado_micro",
  "grupo_whatsapp",
  "link",
  "firma",
] as const;

export const DEFAULT_PAYMENT_CONFIRMED_TEMPLATE = `Hola {{nombre}}, recibimos tu comprobante y tu inscripción a la {{evento}} quedó CONFIRMADA!

{{estado_micro}}

Podés ver el estado de tu inscripción en cualquier momento acá: {{link}}

¡Nos vemos en la peregrinación!

{{firma}}`;

// Se dispara cuando el admin marca la inscripción como pagada.
export function buildPaymentConfirmedEmail(
  registration: RegistrationRow,
  event: EventRow,
  startingPoint: StartingPointRow | null,
  bus: BusRow | null,
): { subject: string; text: string } {
  const link = `${siteUrl()}${magicLinkPath(registration.id)}`;

  const estadoMicro = bus
    ? `Vas en el Micro ${bus.bus_number}. Salís desde ${startingPoint?.name ?? "-"}, presentarte ${startingPoint?.presentation_time.slice(0, 5)}hs en ${startingPoint?.presentation_location ?? "-"}.`
    : "Todavía no te asignamos micro — te vamos a avisar por acá o por WhatsApp en cuanto lo hagamos.";

  const template = event.email_payment_confirmed_template || DEFAULT_PAYMENT_CONFIRMED_TEMPLATE;

  const text = renderTemplate(template, {
    nombre: registration.first_name,
    evento: event.name,
    estado_micro: estadoMicro,
    grupo_whatsapp: event.whatsapp_group_invite_url ?? "",
    link,
    firma: SIGNATURE,
  });

  return { subject: `Inscripción confirmada — ${event.name}`, text };
}

export async function sendPaymentConfirmedEmail(
  registration: RegistrationRow,
  event: EventRow,
  startingPoint: StartingPointRow | null,
  bus: BusRow | null,
) {
  const { subject, text } = buildPaymentConfirmedEmail(registration, event, startingPoint, bus);
  await sendEmail({ to: registration.email, subject, text });
}
