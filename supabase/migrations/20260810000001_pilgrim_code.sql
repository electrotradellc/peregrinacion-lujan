-- Código único por peregrino (ej. micro 1 -> 101..140, micro 2 -> 201..240),
-- asignado automáticamente al asignar el micro de ida. Único por evento.
alter table public.registrations
  add column pilgrim_code integer;

create unique index registrations_event_pilgrim_code_idx
  on public.registrations (event_id, pilgrim_code)
  where pilgrim_code is not null;
