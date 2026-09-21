import { z } from "zod";
import { dniSchema, phoneSchema, toTitleCase } from "./registrationSchema";

// Subconjunto liviano del formulario de inscripción — solo lo necesario
// para poder contactar a la persona cuando se libere un cupo. El resto de
// los datos (obra social, info médica, T&C) se cargan recién al completar
// la inscripción real desde el link de invitación.
export const waitlistFieldsSchema = z.object({
  eventId: z.uuid(),
  startingPointId: z.uuid("Elegí desde dónde salís caminando"),
  firstName: z.string().trim().min(1, "Ingresá el nombre").transform(toTitleCase),
  lastName: z.string().trim().min(1, "Ingresá el apellido").transform(toTitleCase),
  dni: dniSchema,
  phone: phoneSchema,
  email: z.email("Ingresá un email válido").transform((v) => v.toLowerCase()),
});

export type WaitlistFields = z.infer<typeof waitlistFieldsSchema>;
