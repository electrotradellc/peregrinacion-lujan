-- Contacto del coordinador general de capitanes, para que el peregrino lo
-- vea en /mi-inscripcion junto al whatsapp de su propio capitán de micro.
alter table public.events
  add column captains_coordinator_name text,
  add column captains_coordinator_whatsapp text;
