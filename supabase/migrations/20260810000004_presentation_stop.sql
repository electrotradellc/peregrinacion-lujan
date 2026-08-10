-- La parada de presentación (la Parroquia, punto de partida) es distinta a
-- las demás: solo se marca "se presentó" (no llegada+salida), y si alguien
-- no se presenta se lo puede marcar directamente como no-show, lo que lo
-- saca de todos los demás listados (mismo mecanismo que cancelar).
alter table public.stops
  add column is_presentation_stop boolean not null default false;

-- Permite que el capitán de un micro marque como cancelada (no-show) a una
-- inscripción CONFIRMADA que esté asignada a su propio micro de ida — nada
-- más. No puede tocar otros estados ni inscripciones de otros micros.
create policy "registrations_captain_mark_no_show" on public.registrations for update
  using (
    status = 'confirmed'
    and exists (
      select 1 from public.bus_assignments ba
      where ba.registration_id = registrations.id
        and ba.direction = 'outbound'
        and public.is_captain_of_bus(ba.bus_id)
    )
  )
  with check (status = 'cancelled');
