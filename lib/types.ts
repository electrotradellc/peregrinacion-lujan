// Tipos de dominio a mano, reflejando el esquema de supabase/migrations/.
// Reemplazar/complementar con `supabase gen types typescript` una vez que el
// proyecto esté linkeado a una instancia real de Supabase.

export type UserRole = "admin" | "bus_captain";
export type EventStatus = "draft" | "open" | "closed" | "archived";
export type RegistrationStatus =
  | "pending_payment"
  | "confirmed"
  | "payment_failed"
  | "expired"
  | "cancelled";
export type PaymentStatus =
  | "created"
  | "pending"
  | "approved"
  | "rejected"
  | "refunded"
  | "cancelled";
export type AssignmentDirection = "outbound" | "return";
export type CheckinEventType = "arrival" | "departure" | "support_vehicle";

export interface EventRow {
  id: string;
  name: string;
  event_date: string;
  registration_price_ars: number;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  status: EventStatus;
  walking_recommendations: string | null;
  whatsapp_group_invite_url: string | null;
  payment_alias: string | null;
  payment_instructions: string | null;
  contact_email: string | null;
  captains_coordinator_name: string | null;
  captains_coordinator_whatsapp: string | null;
  email_registration_pending_template: string | null;
  email_payment_confirmed_template: string | null;
  bus_assignments_confirmed_at: string | null;
  terms_and_conditions: string;
  terms_version: string;
  pending_payment_expiry_days: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface StartingPointRow {
  id: string;
  event_id: string;
  name: string;
  presentation_time: string;
  presentation_location: string;
  notes: string | null;
  created_at: string;
}

export interface BusRow {
  id: string;
  event_id: string;
  starting_point_id: string;
  bus_number: number;
  capacity: number;
  created_at: string;
}

export interface StopRow {
  id: string;
  event_id: string;
  sequence_order: number;
  name: string;
  location_description: string | null;
  maps_url: string | null;
  expected_time: string | null;
  is_presentation_stop: boolean;
  created_at: string;
}

export interface ProfileRow {
  id: string;
  full_name: string;
  phone: string | null;
  whatsapp_phone: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface BusCaptainAssignmentRow {
  id: string;
  profile_id: string;
  bus_id: string;
  event_id: string;
  created_at: string;
}

export interface RegistrationRow {
  id: string;
  event_id: string;
  first_name: string;
  last_name: string;
  dni: string;
  phone: string;
  email: string;
  birth_date: string;
  dni_photo_path: string;
  has_health_insurance: boolean;
  health_insurance_provider: string | null;
  health_insurance_member_number: string | null;
  health_insurance_card_photo_path: string | null;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  starting_point_id: string;
  returns_independently: boolean;
  has_allergies: boolean;
  allergies_detail: string | null;
  has_celiac: boolean;
  has_diabetes: boolean;
  has_hypertension: boolean;
  has_respiratory_condition: boolean;
  has_heart_condition: boolean;
  has_other_condition: boolean;
  other_condition_detail: string | null;
  takes_medication: boolean;
  medication_detail: string | null;
  terms_accepted_at: string;
  terms_version: string;
  pilgrim_code: number | null;
  status: RegistrationStatus;
  created_at: string;
  updated_at: string;
}

export interface PaymentRow {
  id: string;
  registration_id: string;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  status: PaymentStatus;
  amount: number | null;
  raw_webhook_payload: unknown;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusAssignmentRow {
  id: string;
  registration_id: string;
  bus_id: string;
  direction: AssignmentDirection;
  assigned_by: string | null;
  assigned_at: string;
}

export interface AttendanceCheckinRow {
  id: string;
  registration_id: string;
  bus_id: string;
  stop_id: string;
  direction: AssignmentDirection;
  event_type: CheckinEventType;
  recorded_at: string;
  recorded_by: string;
  device_id: string | null;
  client_created_at: string;
  synced_at: string;
}

export interface EventAuditLogRow {
  id: string;
  event_id: string | null;
  actor_id: string | null;
  action: string;
  entity_table: string;
  entity_id: string | null;
  diff: unknown;
  created_at: string;
}

// Fila devuelta por la función SECURITY DEFINER get_captain_roster() —
// deliberadamente sin DNI, fotos, email ni datos de obra social.
export interface CaptainRosterRow {
  registration_id: string;
  pilgrim_code: number | null;
  first_name: string;
  last_name: string;
  phone: string;
  starting_point_name: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  has_allergies: boolean;
  allergies_detail: string | null;
  has_celiac: boolean;
  has_diabetes: boolean;
  has_hypertension: boolean;
  has_respiratory_condition: boolean;
  has_heart_condition: boolean;
  has_other_condition: boolean;
  other_condition_detail: string | null;
  takes_medication: boolean;
  medication_detail: string | null;
}
