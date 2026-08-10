-- Peregrinación a Luján — RLS, grants, funciones de seguridad y triggers de negocio.
--
-- Decisión de diseño clave: `registrations` NO tiene política SELECT para
-- capitanes. Los capitanes nunca acceden a la tabla base (evita que alguien
-- con sesión de capitán pueda hacer `select * from registrations` y ver DNI /
-- fotos). En cambio, usan la función `get_captain_roster()` (SECURITY
-- DEFINER más abajo), que expone solo las columnas necesarias para una
-- emergencia y valida internamente que el capitán sea dueño de ese micro.

alter table public.events enable row level security;
alter table public.starting_points enable row level security;
alter table public.buses enable row level security;
alter table public.stops enable row level security;
alter table public.profiles enable row level security;
alter table public.bus_captain_assignments enable row level security;
alter table public.registrations enable row level security;
alter table public.payments enable row level security;
alter table public.mp_webhook_log enable row level security;
alter table public.bus_assignments enable row level security;
alter table public.attendance_checkins enable row level security;
alter table public.event_audit_log enable row level security;

grant usage on schema public to anon, authenticated;

-- ============================================================================
-- FUNCIONES DE AUTORIZACIÓN ADICIONALES
-- ============================================================================

create or replace function public.is_captain_of_bus(p_bus_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.bus_captain_assignments
    where profile_id = auth.uid() and bus_id = p_bus_id
  );
$$;

-- ============================================================================
-- events / starting_points / buses / stops — configuración, sin PII
-- ============================================================================

grant select on public.events, public.starting_points, public.buses, public.stops
  to anon, authenticated;
grant insert, update, delete on public.events, public.starting_points, public.buses, public.stops
  to authenticated;

create policy "events_select_all" on public.events for select using (true);
create policy "events_admin_write" on public.events for all
  using (public.is_admin()) with check (public.is_admin());

create policy "starting_points_select_all" on public.starting_points for select using (true);
create policy "starting_points_admin_write" on public.starting_points for all
  using (public.is_admin()) with check (public.is_admin());

create policy "buses_select_all" on public.buses for select using (true);
create policy "buses_admin_write" on public.buses for all
  using (public.is_admin()) with check (public.is_admin());

create policy "stops_select_all" on public.stops for select using (true);
create policy "stops_admin_write" on public.stops for all
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- profiles
-- ============================================================================

grant select, update on public.profiles to authenticated;
grant insert, delete on public.profiles to authenticated; -- restringido por RLS a admin

create policy "profiles_select_self_or_admin" on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy "profiles_update_self_or_admin" on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy "profiles_admin_insert" on public.profiles for insert
  with check (public.is_admin());
create policy "profiles_admin_delete" on public.profiles for delete
  using (public.is_admin());

-- evita que un capitán se autoasigne el rol admin
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and new.role is distinct from old.role then
    raise exception 'No podés modificar tu propio rol';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_self_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_self_role_escalation();

-- crea el profile automáticamente cuando se crea un auth.users
-- (usado tanto por el signup propio como por el alta de capitanes vía Admin API)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, whatsapp_phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.raw_user_meta_data ->> 'whatsapp_phone',
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'bus_captain')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- bus_captain_assignments
-- ============================================================================

grant select on public.bus_captain_assignments to authenticated;
grant insert, update, delete on public.bus_captain_assignments to authenticated;

create policy "bus_captain_assignments_select" on public.bus_captain_assignments for select
  using (profile_id = auth.uid() or public.is_admin());
create policy "bus_captain_assignments_admin_write" on public.bus_captain_assignments for all
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- registrations
-- ============================================================================

-- el formulario público inserta directamente (anon), siempre en pending_payment
grant insert on public.registrations to anon, authenticated;
grant select, update on public.registrations to authenticated; -- limitado a admin por RLS

create policy "registrations_public_insert" on public.registrations for insert
  to anon, authenticated
  with check (status = 'pending_payment');

create policy "registrations_admin_select" on public.registrations for select
  using (public.is_admin());

create policy "registrations_admin_update" on public.registrations for update
  using (public.is_admin()) with check (public.is_admin());

-- sin política de delete: las bajas son lógicas (status = 'cancelled')

-- ============================================================================
-- payments — solo admin lee; solo el webhook (service role) escribe
-- ============================================================================

grant select on public.payments to authenticated;

create policy "payments_admin_select" on public.payments for select
  using (public.is_admin());

grant select on public.mp_webhook_log to authenticated;

create policy "mp_webhook_log_admin_select" on public.mp_webhook_log for select
  using (public.is_admin());

-- ============================================================================
-- bus_assignments
-- ============================================================================

grant select on public.bus_assignments to authenticated;
grant insert, update, delete on public.bus_assignments to authenticated;

create policy "bus_assignments_select" on public.bus_assignments for select
  using (public.is_admin() or public.is_captain_of_bus(bus_id));

create policy "bus_assignments_admin_write" on public.bus_assignments for all
  using (public.is_admin()) with check (public.is_admin());

-- capacidad del micro: nunca se puede asignar por encima de bus.capacity
create or replace function public.enforce_bus_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity int;
  v_count int;
begin
  perform 1 from public.buses where id = new.bus_id for update;
  select capacity into v_capacity from public.buses where id = new.bus_id;
  select count(*) into v_count from public.bus_assignments
    where bus_id = new.bus_id and direction = new.direction
      and id is distinct from new.id;
  if v_count >= v_capacity then
    raise exception 'El micro ya alcanzó su capacidad de % pasajeros', v_capacity;
  end if;
  return new;
end;
$$;

create trigger bus_assignments_enforce_capacity
  before insert on public.bus_assignments
  for each row execute function public.enforce_bus_capacity();

-- un micro nunca puede llevar gente de un punto de partida distinto al suyo
create or replace function public.enforce_bus_starting_point_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bus_sp uuid;
  v_reg_sp uuid;
begin
  select starting_point_id into v_bus_sp from public.buses where id = new.bus_id;
  select starting_point_id into v_reg_sp from public.registrations where id = new.registration_id;
  if v_bus_sp is distinct from v_reg_sp then
    raise exception 'El punto de partida del peregrino no coincide con el del micro';
  end if;
  return new;
end;
$$;

create trigger bus_assignments_enforce_starting_point
  before insert or update on public.bus_assignments
  for each row execute function public.enforce_bus_starting_point_match();

-- ============================================================================
-- attendance_checkins — el corazón del diseño offline-first
-- ============================================================================

grant select, insert on public.attendance_checkins to authenticated;
grant delete on public.attendance_checkins to authenticated; -- limitado a admin por RLS

create policy "attendance_checkins_select" on public.attendance_checkins for select
  using (public.is_admin() or public.is_captain_of_bus(bus_id));

create policy "attendance_checkins_insert" on public.attendance_checkins for insert
  with check (
    public.is_admin()
    or (public.is_captain_of_bus(bus_id) and recorded_by = auth.uid())
  );

-- sin política de update: un check-in sincronizado es inmutable (la corrección
-- correcta es borrar + volver a insertar, registrado en event_audit_log)

create policy "attendance_checkins_admin_delete" on public.attendance_checkins for delete
  using (public.is_admin());

-- ============================================================================
-- event_audit_log
-- ============================================================================

grant select, insert on public.event_audit_log to authenticated;

create policy "event_audit_log_admin_select" on public.event_audit_log for select
  using (public.is_admin());

create policy "event_audit_log_self_insert" on public.event_audit_log for insert
  with check (actor_id = auth.uid());

-- ============================================================================
-- roster del capitán — función SECURITY DEFINER con columnas restringidas
--
-- Expone solo lo necesario ante una emergencia (nombre, contacto de
-- emergencia, resumen médico) y NUNCA DNI, fotos, email ni obra social.
-- No depende de RLS sobre `registrations` (que es admin-only) porque corre
-- con privilegios elevados y hace su propia verificación de autorización.
-- ============================================================================

create or replace function public.get_captain_roster(p_bus_id uuid, p_direction public.assignment_direction)
returns table (
  registration_id uuid,
  first_name text,
  last_name text,
  starting_point_name text,
  emergency_contact_name text,
  emergency_contact_phone text,
  has_allergies boolean,
  allergies_detail text,
  has_celiac boolean,
  has_diabetes boolean,
  has_hypertension boolean,
  has_respiratory_condition boolean,
  has_heart_condition boolean,
  has_other_condition boolean,
  other_condition_detail text,
  takes_medication boolean,
  medication_detail text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id, r.first_name, r.last_name, sp.name,
    r.emergency_contact_name, r.emergency_contact_phone,
    r.has_allergies, r.allergies_detail, r.has_celiac, r.has_diabetes,
    r.has_hypertension, r.has_respiratory_condition, r.has_heart_condition,
    r.has_other_condition, r.other_condition_detail, r.takes_medication, r.medication_detail
  from public.registrations r
  join public.bus_assignments ba
    on ba.registration_id = r.id and ba.direction = p_direction and ba.bus_id = p_bus_id
  join public.starting_points sp on sp.id = r.starting_point_id
  where r.status = 'confirmed'
    and (public.is_admin() or public.is_captain_of_bus(p_bus_id));
$$;

grant execute on function public.get_captain_roster(uuid, public.assignment_direction) to authenticated;

-- ============================================================================
-- STORAGE — bucket privado para fotos de DNI / carnet de obra social
--
-- Sin políticas para anon/authenticated a propósito: toda subida (registro
-- público) y toda lectura (URL firmada para admin) pasa por Route Handlers
-- server-side usando la service role key, que ignora RLS. Así el DNI/carnet
-- nunca queda expuesto a una sesión de cliente, ni siquiera de admin.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('registration-documents', 'registration-documents', false)
on conflict (id) do nothing;
