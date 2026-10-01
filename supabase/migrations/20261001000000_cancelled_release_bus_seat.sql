-- Una inscripción cancelada no ocupa lugar en los micros ni conserva su Nro
-- de peregrino: al pasar a 'cancelled' (desde el admin, o "no se presentó"
-- del capitán) se borran sus asignaciones de micro y se libera el código.
-- security definer porque el capitán puede marcar ausente pero no tiene
-- permiso de borrar asignaciones por RLS.
create or replace function public.release_bus_seat_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.bus_assignments where registration_id = new.id;
  new.pilgrim_code := null;
  return new;
end;
$$;

create trigger registrations_release_bus_seat_on_cancel
  before update of status on public.registrations
  for each row
  when (new.status = 'cancelled' and old.status is distinct from 'cancelled')
  execute function public.release_bus_seat_on_cancel();

-- Limpieza de las ya canceladas hoy.
delete from public.bus_assignments
  where registration_id in (select id from public.registrations where status = 'cancelled');
update public.registrations set pilgrim_code = null
  where status = 'cancelled' and pilgrim_code is not null;
