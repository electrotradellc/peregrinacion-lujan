-- Nombre de la obra social/prepaga (además del número de afiliado que ya
-- existía), para saber "¿cuál?" cuando el inscripto tilda que tiene.
alter table public.registrations
  add column health_insurance_provider text;
