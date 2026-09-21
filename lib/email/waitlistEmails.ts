import "server-only";
import { sendEmail } from "./client";
import { siteUrl, SIGNATURE } from "./registrationEmails";
import { waitlistInvitePath } from "@/lib/magicLink";
import type { EventRow, StartingPointRow, WaitlistEntryRow } from "@/lib/types";
import type { WaitlistFields } from "@/lib/validation/waitlistSchema";

// Se dispara al anotarse en la lista de espera (punto de partida sin
// cupos). Solo confirma que quedó anotado/a — no promete nada de plazos,
// porque depende de que el admin decida agregar un micro.
export async function sendWaitlistConfirmationEmail(
  entry: WaitlistFields,
  event: EventRow,
  startingPoint: StartingPointRow,
) {
  const subject = `Te anotamos en la lista de espera — ${event.name}`;
  const text = `Hola ${entry.firstName}!

En este momento no quedan cupos disponibles para salir desde ${startingPoint.name} en la ${event.name}, así que te anotamos en la lista de espera para ese punto de partida.

Si se libera un lugar (por ejemplo, si agregamos otro micro), te vamos a avisar por este mismo email con un link para que completes tu inscripción. El aviso es por orden de llegada a la lista.

${SIGNATURE}`;
  await sendEmail({ to: entry.email, subject, text });
}

// Se dispara cuando el admin invita manualmente a los próximos N de la
// cola (Admin → Lista de espera) después de agregar o agrandar un micro.
export function buildWaitlistInviteEmail(
  entry: WaitlistEntryRow,
  event: EventRow,
  startingPoint: StartingPointRow,
): { subject: string; text: string } {
  const link = `${siteUrl()}${waitlistInvitePath(event.id, entry.id)}`;
  const subject = `¡Se liberó un cupo! Completá tu inscripción — ${event.name}`;
  const text = `Hola ${entry.first_name}!

¡Buenas noticias! Se liberó un cupo para salir desde ${startingPoint.name} en la ${event.name} y te toca a vos en la lista de espera.

Completá tu inscripción cuanto antes desde acá (ya viene con tus datos precargados): ${link}

El lugar no queda reservado hasta que termines de enviar la inscripción, así que te recomendamos completarla lo antes posible.

${SIGNATURE}`;
  return { subject, text };
}

export async function sendWaitlistInviteEmail(
  entry: WaitlistEntryRow,
  event: EventRow,
  startingPoint: StartingPointRow,
) {
  const { subject, text } = buildWaitlistInviteEmail(entry, event, startingPoint);
  await sendEmail({ to: entry.email, subject, text });
}
