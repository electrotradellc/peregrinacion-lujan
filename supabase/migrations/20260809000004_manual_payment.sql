-- El cobro pasa a ser manual (alias / efectivo en Secretaría Parroquial,
-- confirmado a mano por el admin al recibir el comprobante) en vez de
-- Mercado Pago automático. Se agrega contenido editable por evento para
-- mostrar esas instrucciones de pago al inscripto.
alter table public.events
  add column payment_alias text,
  add column payment_instructions text;
