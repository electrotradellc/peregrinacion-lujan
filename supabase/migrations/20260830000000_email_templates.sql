-- Texto editable de los emails automáticos (inscripción recibida / pago
-- confirmado) desde Config, en vez de hardcodeado en el código. NULL = usa el
-- texto por defecto (ver DEFAULT_*_TEMPLATE en lib/email/registrationEmails.ts).
alter table public.events
  add column email_registration_pending_template text,
  add column email_payment_confirmed_template text;
