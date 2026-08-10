-- Mail de contacto del evento: adonde piden que se mande el comprobante de
-- pago, y el reply-to de los emails automáticos de inscripción/confirmación.
alter table public.events
  add column contact_email text;
