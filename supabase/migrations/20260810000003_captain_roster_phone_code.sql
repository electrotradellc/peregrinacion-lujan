-- La planilla de asistencia (usada también por capitanes) necesita el
-- celular del peregrino (para poder llamarlo si falta en una parada) y su
-- número/código de micro. Se agregan a la función SECURITY DEFINER del
-- roster del capitán — sigue sin exponer DNI, fotos, email ni obra social.
drop function if exists public.get_captain_roster(uuid, public.assignment_direction);

create function public.get_captain_roster(p_bus_id uuid, p_direction public.assignment_direction)
returns table (
  registration_id uuid,
  pilgrim_code integer,
  first_name text,
  last_name text,
  phone text,
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
    r.id, r.pilgrim_code, r.first_name, r.last_name, r.phone, sp.name,
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
