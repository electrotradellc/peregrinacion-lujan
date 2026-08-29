import "server-only";
import { buildRegistrationPendingEmail, buildPaymentConfirmedEmail } from "./registrationEmails";
import type { EventRow, RegistrationRow, StartingPointRow, BusRow } from "@/lib/types";

// Datos ficticios solo para mostrar en Config → Emails automáticos cómo
// queda el texto real (con las instrucciones de pago, nombre del evento,
// etc. ya cargados) sin mandar ningún email de verdad.
function exampleRegistration(eventId: string): RegistrationRow {
  const now = new Date().toISOString();
  return {
    id: "00000000-0000-0000-0000-000000000000",
    event_id: eventId,
    first_name: "Juan",
    last_name: "Pérez",
    dni: "30123456",
    phone: "+5491122334455",
    email: "juan.perez@ejemplo.com",
    birth_date: "1990-05-20",
    dni_photo_path: "",
    has_health_insurance: true,
    health_insurance_provider: "OSDE",
    health_insurance_member_number: "123456789",
    health_insurance_card_photo_path: null,
    emergency_contact_name: "María Pérez",
    emergency_contact_phone: "+5491133445566",
    starting_point_id: "00000000-0000-0000-0000-000000000001",
    returns_independently: false,
    has_allergies: false,
    allergies_detail: null,
    has_celiac: false,
    has_diabetes: false,
    has_hypertension: false,
    has_respiratory_condition: false,
    has_heart_condition: false,
    has_other_condition: false,
    other_condition_detail: null,
    takes_medication: false,
    medication_detail: null,
    terms_accepted_at: now,
    terms_version: "1",
    pilgrim_code: 42,
    status: "pending_payment",
    created_at: now,
    updated_at: now,
  };
}

function exampleStartingPoint(eventId: string): StartingPointRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    event_id: eventId,
    name: "Liniers",
    presentation_time: "07:00:00",
    presentation_location: "Parroquia San Isidro Labrador",
    notes: null,
    created_at: new Date().toISOString(),
  };
}

function exampleBus(eventId: string, startingPointId: string): BusRow {
  return {
    id: "00000000-0000-0000-0000-000000000002",
    event_id: eventId,
    starting_point_id: startingPointId,
    bus_number: 3,
    capacity: 40,
    created_at: new Date().toISOString(),
  };
}

export function buildEmailPreviews(event: EventRow) {
  const registration = exampleRegistration(event.id);
  const startingPoint = exampleStartingPoint(event.id);
  const bus = exampleBus(event.id, startingPoint.id);

  return {
    registrationPending: buildRegistrationPendingEmail(registration, event, startingPoint),
    paymentConfirmed: buildPaymentConfirmedEmail(registration, event, startingPoint, bus),
  };
}
