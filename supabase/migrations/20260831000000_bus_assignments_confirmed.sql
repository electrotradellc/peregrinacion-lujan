-- Hasta que el admin confirme la lista definitiva de micros, /mi-inscripcion
-- no muestra el número de micro asignado ni los botones de WhatsApp del
-- capitán/coordinador (la asignación se va reacomodando durante todo el
-- proceso de inscripción, y no queremos mostrar algo que después cambia).
alter table public.events
  add column bus_assignments_confirmed_at timestamptz;
