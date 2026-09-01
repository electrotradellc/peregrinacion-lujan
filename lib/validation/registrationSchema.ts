import { z } from "zod";

// Schema compartido entre el formulario (Client Component, react-hook-form)
// y el Route Handler (server-side, nunca confiar solo en la validación del
// cliente). Los archivos (foto DNI / carnet) se validan aparte con
// `validatePhotoFile`, porque llegan como `File` dentro de un FormData, no
// como parte de este objeto JSON-serializable.

const digitsOnly = (value: string) => value.replace(/\D/g, "");

// Los pilgrims suelen pegar el número con el código de país (+54, 54, +549,
// 549) porque así lo ven en WhatsApp — acá se saca solo, no hace falta que
// se den cuenta ni que corrijan un error de validación.
const stripCountryCode = (value: string) => {
  if (value.startsWith("549")) return value.slice(3);
  if (value.startsWith("54")) return value.slice(2);
  return value;
};

export const formatPhoneDigits = (raw: string) => stripCountryCode(digitsOnly(raw));

// Nombre Propio: primera letra de cada palabra en mayúscula, resto en
// minúscula. \p{L} (con flag u) matchea letras con tilde/ñ, no solo a-z.
export const toTitleCase = (value: string) =>
  value.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (match) => match.toUpperCase());

export const dniSchema = z
  .string()
  .trim()
  .transform(digitsOnly)
  .pipe(z.string().regex(/^\d{7,8}$/, "El DNI debe tener 7 u 8 dígitos"));

export const phoneSchema = z
  .string()
  .trim()
  .transform(formatPhoneDigits)
  .pipe(z.string().min(8, "Ingresá un número de celular válido (característica + número, sin el 54)"));

export const registrationFieldsSchema = z
  .object({
    eventId: z.uuid(),

    // datos personales
    firstName: z.string().trim().min(1, "Ingresá el nombre").transform(toTitleCase),
    lastName: z.string().trim().min(1, "Ingresá el apellido").transform(toTitleCase),
    dni: dniSchema,
    phone: phoneSchema,
    email: z.email("Ingresá un email válido").transform((v) => v.toLowerCase()),
    birthDate: z.iso.date("Ingresá una fecha de nacimiento válida"),

    // obra social
    hasHealthInsurance: z.boolean(),
    healthInsuranceProvider: z.string().trim().optional(),
    healthInsuranceMemberNumber: z.string().trim().optional(),

    // contacto de emergencia
    emergencyContactName: z.string().trim().min(1, "Ingresá el nombre del contacto de emergencia"),
    emergencyContactPhone: phoneSchema,

    // punto de partida
    startingPointId: z.uuid("Elegí desde dónde salís caminando"),
    returnsIndependently: z.boolean(),

    // información médica
    hasAllergies: z.boolean(),
    allergiesDetail: z.string().trim().optional(),
    hasCeliac: z.boolean(),
    hasDiabetes: z.boolean(),
    hasHypertension: z.boolean(),
    hasRespiratoryCondition: z.boolean(),
    hasHeartCondition: z.boolean(),
    hasOtherCondition: z.boolean(),
    otherConditionDetail: z.string().trim().optional(),
    takesMedication: z.boolean(),
    medicationDetail: z.string().trim().optional(),

    // términos y condiciones
    termsVersion: z.string().min(1),
    termsAccepted: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.hasHealthInsurance && !data.healthInsuranceProvider) {
      ctx.addIssue({
        code: "custom",
        path: ["healthInsuranceProvider"],
        message: "Indicá cuál es tu obra social",
      });
    }
    if (data.hasHealthInsurance && !data.healthInsuranceMemberNumber) {
      ctx.addIssue({
        code: "custom",
        path: ["healthInsuranceMemberNumber"],
        message: "Ingresá el número de afiliado",
      });
    }
    if (data.hasAllergies && !data.allergiesDetail) {
      ctx.addIssue({
        code: "custom",
        path: ["allergiesDetail"],
        message: "Indicá a qué es alérgico/a",
      });
    }
    if (data.hasOtherCondition && !data.otherConditionDetail) {
      ctx.addIssue({
        code: "custom",
        path: ["otherConditionDetail"],
        message: "Especificá la condición",
      });
    }
    if (data.takesMedication && !data.medicationDetail) {
      ctx.addIssue({
        code: "custom",
        path: ["medicationDetail"],
        message: "Indicá qué medicación toma",
      });
    }
    if (!data.termsAccepted) {
      ctx.addIssue({
        code: "custom",
        path: ["termsAccepted"],
        message: "Tenés que aceptar los Términos y Condiciones para continuar",
      });
    }
  });

export type RegistrationFields = z.infer<typeof registrationFieldsSchema>;

// --- Validación de archivos (foto DNI / carnet de obra social) ---------

export const MAX_PHOTO_SIZE_BYTES = 8 * 1024 * 1024; // 8MB
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export function validatePhotoFile(file: File | null, required: boolean): string | null {
  if (!file || file.size === 0) {
    return required ? "Subí una foto" : null;
  }
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "El archivo debe ser una foto (JPG, PNG, WEBP o HEIC)";
  }
  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    return "La foto no puede pesar más de 8MB";
  }
  return null;
}
