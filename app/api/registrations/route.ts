import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRegistrationPreference } from "@/lib/mercadopago/createPreference";
import {
  registrationFieldsSchema,
  validatePhotoFile,
} from "@/lib/validation/registrationSchema";
import type { EventRow } from "@/lib/types";

export const runtime = "nodejs";

function extensionFor(file: File): string {
  const fromType = file.type.split("/")[1];
  return fromType === "jpeg" ? "jpg" : (fromType ?? "jpg");
}

export async function POST(request: Request) {
  const formData = await request.formData();

  const raw = Object.fromEntries(formData.entries());
  const parsed = registrationFieldsSchema.safeParse({
    ...raw,
    hasHealthInsurance: raw.hasHealthInsurance === "true",
    hasAllergies: raw.hasAllergies === "true",
    hasCeliac: raw.hasCeliac === "true",
    hasDiabetes: raw.hasDiabetes === "true",
    hasHypertension: raw.hasHypertension === "true",
    hasRespiratoryCondition: raw.hasRespiratoryCondition === "true",
    hasHeartCondition: raw.hasHeartCondition === "true",
    hasOtherCondition: raw.hasOtherCondition === "true",
    takesMedication: raw.takesMedication === "true",
    termsAccepted: raw.termsAccepted === "true",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revisá los datos del formulario.", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const dniPhoto = formData.get("dniPhoto");
  const insurancePhoto = formData.get("healthInsuranceCardPhoto");
  const dniPhotoFile = dniPhoto instanceof File ? dniPhoto : null;
  const insurancePhotoFile = insurancePhoto instanceof File ? insurancePhoto : null;

  const dniError = validatePhotoFile(dniPhotoFile, true);
  const insuranceError = validatePhotoFile(insurancePhotoFile, data.hasHealthInsurance);
  if (dniError || insuranceError) {
    return NextResponse.json({ error: dniError ?? insuranceError }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", data.eventId)
    .single<EventRow>();

  if (!event || event.status !== "open") {
    return NextResponse.json(
      { error: "La inscripción para este evento no está disponible." },
      { status: 400 },
    );
  }

  // Tope duro de 200 inscriptos confirmados/pendientes para evitar sobreventa;
  // la asignación real a un micro específico la controla el admin después.
  const { count: activeCount } = await supabase
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", data.eventId)
    .in("status", ["pending_payment", "confirmed"]);

  const { data: buses } = await supabase.from("buses").select("capacity").eq("event_id", data.eventId);
  const totalCapacity = (buses ?? []).reduce((sum, b) => sum + b.capacity, 0);
  if (totalCapacity > 0 && (activeCount ?? 0) >= totalCapacity) {
    return NextResponse.json(
      { error: "Ya no quedan lugares disponibles para este evento." },
      { status: 400 },
    );
  }

  const registrationId = crypto.randomUUID();
  const bucket = supabase.storage.from("registration-documents");

  const dniPhotoPath = `${data.eventId}/${registrationId}/dni.${extensionFor(dniPhotoFile!)}`;
  const { error: dniUploadError } = await bucket.upload(dniPhotoPath, dniPhotoFile!, {
    contentType: dniPhotoFile!.type,
    upsert: false,
  });
  if (dniUploadError) {
    return NextResponse.json({ error: "No pudimos subir la foto del DNI." }, { status: 500 });
  }

  let insuranceCardPhotoPath: string | null = null;
  if (data.hasHealthInsurance && insurancePhotoFile) {
    insuranceCardPhotoPath = `${data.eventId}/${registrationId}/obra-social.${extensionFor(insurancePhotoFile)}`;
    const { error: insuranceUploadError } = await bucket.upload(
      insuranceCardPhotoPath,
      insurancePhotoFile,
      { contentType: insurancePhotoFile.type, upsert: false },
    );
    if (insuranceUploadError) {
      return NextResponse.json(
        { error: "No pudimos subir la foto del carnet de obra social." },
        { status: 500 },
      );
    }
  }

  const { error: insertError } = await supabase.from("registrations").insert({
    id: registrationId,
    event_id: data.eventId,
    first_name: data.firstName,
    last_name: data.lastName,
    dni: data.dni,
    phone: data.phone,
    email: data.email,
    birth_date: data.birthDate,
    dni_photo_path: dniPhotoPath,
    has_health_insurance: data.hasHealthInsurance,
    health_insurance_member_number: data.hasHealthInsurance
      ? data.healthInsuranceMemberNumber
      : null,
    health_insurance_card_photo_path: insuranceCardPhotoPath,
    emergency_contact_name: data.emergencyContactName,
    emergency_contact_phone: data.emergencyContactPhone,
    starting_point_id: data.startingPointId,
    has_allergies: data.hasAllergies,
    allergies_detail: data.hasAllergies ? data.allergiesDetail : null,
    has_celiac: data.hasCeliac,
    has_diabetes: data.hasDiabetes,
    has_hypertension: data.hasHypertension,
    has_respiratory_condition: data.hasRespiratoryCondition,
    has_heart_condition: data.hasHeartCondition,
    has_other_condition: data.hasOtherCondition,
    other_condition_detail: data.hasOtherCondition ? data.otherConditionDetail : null,
    takes_medication: data.takesMedication,
    medication_detail: data.takesMedication ? data.medicationDetail : null,
    terms_accepted_at: new Date().toISOString(),
    terms_version: data.termsVersion,
    status: "pending_payment",
  });

  if (insertError) {
    const isDuplicateDni = insertError.code === "23505";
    return NextResponse.json(
      {
        error: isDuplicateDni
          ? "Ese DNI ya tiene una inscripción activa para este evento."
          : "No pudimos registrar la inscripción.",
      },
      { status: isDuplicateDni ? 409 : 500 },
    );
  }

  try {
    const { preferenceId, initPoint } = await createRegistrationPreference({
      registrationId,
      eventName: event.name,
      amount: event.registration_price_ars,
      payerEmail: data.email,
    });

    await supabase.from("payments").insert({
      registration_id: registrationId,
      mp_preference_id: preferenceId,
      status: "created",
      amount: event.registration_price_ars,
    });

    return NextResponse.json({ initPoint });
  } catch {
    return NextResponse.json(
      {
        error:
          "La inscripción se guardó pero no pudimos iniciar el pago. Contactate con la organización.",
      },
      { status: 502 },
    );
  }
}
