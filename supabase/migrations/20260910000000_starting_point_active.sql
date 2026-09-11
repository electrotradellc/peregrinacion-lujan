-- Permite desactivar un punto de partida (ej. cuando se completan sus micros)
-- sin borrarlo, para que deje de ofrecerse en la inscripción pero conserve
-- el historial de inscriptos ya asignados a él.
alter table public.starting_points
  add column is_active boolean not null default true;
