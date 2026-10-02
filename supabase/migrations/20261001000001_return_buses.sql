-- Micros de vuelta: lista propia, independiente de los micros de ida. Se
-- arman sobre la marcha (número + asientos) según los micros que llegan, sin
-- punto de partida ni capitán. La asignación hace de "boleto": quien tiene
-- micro de vuelta asignado es quien se subió, y a cuál.
create table public.return_buses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  bus_number int not null check (bus_number > 0),
  capacity int not null default 40 check (capacity > 0),
  departed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, bus_number)
);

create table public.return_assignments (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references public.registrations(id) on delete cascade,
  return_bus_id uuid not null references public.return_buses(id) on delete cascade,
  assigned_by uuid references auth.users(id),
  assigned_at timestamptz not null default now()
);
create index return_assignments_bus_idx on public.return_assignments (return_bus_id);

alter table public.return_buses enable row level security;
alter table public.return_assignments enable row level security;

grant select, insert, update, delete on public.return_buses to authenticated;
grant select, insert, update, delete on public.return_assignments to authenticated;

create policy "return_buses_admin_all" on public.return_buses for all
  using (public.is_admin()) with check (public.is_admin());
create policy "return_assignments_admin_all" on public.return_assignments for all
  using (public.is_admin()) with check (public.is_admin());

-- El cupo y la salida se controlan en la base: dos admins asignando a la vez
-- no pueden pasarse del cupo (se bloquea la fila del micro mientras se cuenta).
create or replace function public.enforce_return_bus_capacity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  bus public.return_buses%rowtype;
  taken int;
begin
  select * into bus from public.return_buses where id = new.return_bus_id for update;
  if bus.departed_at is not null then
    raise exception 'El micro % ya salió', bus.bus_number;
  end if;
  select count(*) into taken from public.return_assignments
    where return_bus_id = new.return_bus_id and id is distinct from new.id;
  if taken >= bus.capacity then
    raise exception 'El micro % está completo', bus.bus_number;
  end if;
  return new;
end;
$$;

create trigger return_assignments_enforce_capacity
  before insert or update of return_bus_id on public.return_assignments
  for each row execute function public.enforce_return_bus_capacity();

-- Una inscripción cancelada tampoco ocupa lugar en un micro de vuelta.
create or replace function public.release_bus_seat_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.bus_assignments where registration_id = new.id;
  delete from public.return_assignments where registration_id = new.id;
  new.pilgrim_code := null;
  return new;
end;
$$;
