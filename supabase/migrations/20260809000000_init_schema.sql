-- Peregrinación a Luján — esquema inicial
-- Diseñado para ser reutilizable entre eventos: nada de esto está hardcodeado
-- al 3 de octubre de 2026, esa fecha es solo la primera fila de `events`.

-- ============================================================================
-- EXTENSIONES
-- ============================================================================
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ============================================================================
-- ENUMS
-- ============================================================================
create type public.user_role as enum ('admin', 'bus_captain');
create type public.event_status as enum ('draft', 'open', 'closed', 'archived');
create type public.registration_status as enum (
  'pending_payment', 'confirmed', 'payment_failed', 'expired', 'cancelled'
);
create type public.payment_status as enum (
  'created', 'pending', 'approved', 'rejected', 'refunded', 'cancelled'
);
create type public.assignment_direction as enum ('outbound', 'return');
create type public.checkin_event_type as enum ('arrival', 'departure');

-- ============================================================================
-- FUNCIONES DE SOPORTE
-- ============================================================================

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- CONFIGURACIÓN DEL EVENTO
-- ============================================================================

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date not null,
  registration_price_ars numeric(12, 2) not null check (registration_price_ars >= 0),
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  status public.event_status not null default 'draft',
  -- contenido editable para los inscriptos
  walking_recommendations text,
  whatsapp_group_invite_url text,
  terms_and_conditions text not null default '',
  terms_version text not null default '1',
  -- expirar inscripciones pendientes de pago después de N días
  pending_payment_expiry_days int not null default 3 check (pending_payment_expiry_days > 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger events_set_updated_at before update on public.events
  for each row execute function public.set_updated_at();

create table public.starting_points (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null, -- "Liniers", "Gral. Rodríguez"
  presentation_time time not null,
  presentation_location text not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (event_id, name)
);

create table public.buses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  starting_point_id uuid not null references public.starting_points(id) on delete restrict,
  bus_number int not null check (bus_number > 0),
  capacity int not null default 40 check (capacity > 0),
  created_at timestamptz not null default now(),
  unique (event_id, bus_number)
);
create index buses_starting_point_idx on public.buses (starting_point_id);

create table public.stops (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  sequence_order int not null,
  name text not null, -- "Merlo", "La Reja", "Gral. Rodríguez", "Luján"
  location_description text,
  maps_url text, -- link directo a Google Maps, más simple que embeber la API
  expected_time time,
  created_at timestamptz not null default now(),
  unique (event_id, sequence_order)
);

-- ============================================================================
-- PERSONAS Y ROLES
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  whatsapp_phone text, -- formato E.164, ej. +5491122334455 — para el link wa.me del capitán
  role public.user_role not null default 'bus_captain',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.bus_captain_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  bus_id uuid not null references public.buses(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, event_id) -- un capitán maneja un micro por evento
);
create index bus_captain_assignments_bus_idx on public.bus_captain_assignments (bus_id);

-- ============================================================================
-- INSCRIPCIONES
-- ============================================================================

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,

  -- datos personales
  first_name text not null,
  last_name text not null,
  dni text not null,
  phone text not null,
  email text not null,
  birth_date date not null,
  dni_photo_path text not null, -- path privado en Supabase Storage, no URL pública

  -- obra social
  has_health_insurance boolean not null default false,
  health_insurance_member_number text,
  health_insurance_card_photo_path text,

  -- contacto de emergencia
  emergency_contact_name text not null,
  emergency_contact_phone text not null,

  -- punto de partida (determina micros elegibles)
  starting_point_id uuid not null references public.starting_points(id) on delete restrict,

  -- información médica (columnas discretas, no JSON, para poder controlar
  -- acceso columna por columna vía la vista/función de solo-lectura del capitán)
  has_allergies boolean not null default false,
  allergies_detail text,
  has_celiac boolean not null default false,
  has_diabetes boolean not null default false,
  has_hypertension boolean not null default false,
  has_respiratory_condition boolean not null default false,
  has_heart_condition boolean not null default false,
  has_other_condition boolean not null default false,
  other_condition_detail text,
  takes_medication boolean not null default false,
  medication_detail text,

  -- términos y condiciones
  terms_accepted_at timestamptz not null,
  terms_version text not null,

  status public.registration_status not null default 'pending_payment',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint registrations_health_insurance_check check (
    not has_health_insurance or (health_insurance_member_number is not null)
  )
);
create trigger registrations_set_updated_at before update on public.registrations
  for each row execute function public.set_updated_at();

-- un DNI solo puede tener una inscripción "activa" por evento
-- (cancelada/expirada no bloquea un reintento)
create unique index registrations_event_dni_active_idx
  on public.registrations (event_id, dni)
  where status not in ('cancelled', 'expired');

create index registrations_event_status_idx on public.registrations (event_id, status);
create index registrations_starting_point_idx on public.registrations (starting_point_id);

-- ============================================================================
-- PAGOS (Mercado Pago)
-- ============================================================================

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  mp_preference_id text,
  mp_payment_id text unique,
  status public.payment_status not null default 'created',
  amount numeric(12, 2),
  raw_webhook_payload jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger payments_set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();
create index payments_registration_idx on public.payments (registration_id);

-- log de cada notificación de webhook recibida (incluso inválidas), clave para
-- depurar "pagué y no me lo confirmó" después de los hechos
create table public.mp_webhook_log (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  signature_valid boolean not null,
  body jsonb,
  headers jsonb,
  processing_error text
);

-- ============================================================================
-- ASIGNACIÓN DE MICROS (ida y vuelta)
-- ============================================================================

create table public.bus_assignments (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  bus_id uuid not null references public.buses(id) on delete cascade,
  direction public.assignment_direction not null,
  assigned_by uuid references auth.users(id),
  assigned_at timestamptz not null default now(),
  unique (registration_id, direction)
);
create index bus_assignments_bus_idx on public.bus_assignments (bus_id, direction);

-- ============================================================================
-- ASISTENCIA (offline-first, tabla crítica de sincronización)
-- ============================================================================

create table public.attendance_checkins (
  -- id generado en el CLIENTE (uuid v4) al momento de capturar el check-in,
  -- para que reintentar el sync sea idempotente incluso a nivel de fila.
  id uuid primary key,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  bus_id uuid not null references public.buses(id) on delete cascade,
  stop_id uuid not null references public.stops(id) on delete cascade,
  direction public.assignment_direction not null,
  event_type public.checkin_event_type not null,
  recorded_at timestamptz not null, -- hora real del dispositivo del capitán al tocar el botón
  recorded_by uuid not null references auth.users(id),
  device_id text,
  client_created_at timestamptz not null,
  synced_at timestamptz not null default now(),
  -- constraint de negocio: la garantía real de idempotencia. Sincronizar de
  -- más nunca duplica un hecho (llegada/salida de una persona a una parada).
  unique (registration_id, bus_id, stop_id, direction, event_type)
);
create index attendance_checkins_bus_stop_idx
  on public.attendance_checkins (bus_id, stop_id, direction);

-- ============================================================================
-- AUDITORÍA
-- ============================================================================

create table public.event_audit_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_table text not null,
  entity_id uuid,
  diff jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- FUNCIONES DE AUTORIZACIÓN (usadas por las políticas RLS)
-- ============================================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_bus_captain()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'bus_captain'
  );
$$;

-- buses que el capitán actual tiene asignados en el evento dado
create or replace function public.captain_bus_ids(p_event_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select bus_id from public.bus_captain_assignments
  where profile_id = auth.uid() and event_id = p_event_id;
$$;
