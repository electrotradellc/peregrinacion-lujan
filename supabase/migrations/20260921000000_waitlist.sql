-- Lista de espera: cuando un punto de partida se queda sin cupos, la
-- persona se anota acá en vez de simplemente rebotar del formulario. Si el
-- admin agrega o agranda un micro de ese punto, invita manualmente a los
-- primeros N de la cola (orden de llegada) por email, con un link que
-- pre-completa el formulario de inscripción normal — la inscripción en sí
-- sigue validándose contra el cupo real al momento de enviarla (misma
-- lógica que ya usa /api/registrations), esta tabla solo maneja el
-- "avisale a esta gente que puede intentar de nuevo".

create type public.waitlist_status as enum ('waiting', 'invited', 'completed', 'cancelled');

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  starting_point_id uuid not null references public.starting_points(id) on delete restrict,

  first_name text not null,
  last_name text not null,
  dni text not null,
  phone text not null,
  email text not null,

  status public.waitlist_status not null default 'waiting',
  invited_at timestamptz,
  -- se completa cuando la persona termina de inscribirse a partir del email
  -- de invitación; no se borra la fila para conservar el historial de
  -- cuánta gente pasó por la lista de espera de cada punto de partida.
  registration_id uuid references public.registrations(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger waitlist_entries_set_updated_at before update on public.waitlist_entries
  for each row execute function public.set_updated_at();

-- una persona solo puede tener una entrada "esperando" activa por evento;
-- si se cancela puede volver a anotarse (mismo criterio que
-- registrations_event_dni_active_idx con cancelled/expired)
create unique index waitlist_entries_event_dni_waiting_idx
  on public.waitlist_entries (event_id, dni)
  where status = 'waiting';

-- cola FIFO por punto de partida: siempre se invita a quien se anotó primero
create index waitlist_entries_queue_idx
  on public.waitlist_entries (event_id, starting_point_id, status, created_at);

alter table public.waitlist_entries enable row level security;

grant insert on public.waitlist_entries to anon, authenticated;
grant select, update on public.waitlist_entries to authenticated;

-- el formulario público inserta directamente (anon), siempre en 'waiting'
create policy "waitlist_entries_public_insert" on public.waitlist_entries for insert
  to anon, authenticated
  with check (status = 'waiting');

create policy "waitlist_entries_admin_select" on public.waitlist_entries for select
  using (public.is_admin());

create policy "waitlist_entries_admin_update" on public.waitlist_entries for update
  using (public.is_admin()) with check (public.is_admin());

-- sin política de delete: las bajas son lógicas (status = 'cancelled')
