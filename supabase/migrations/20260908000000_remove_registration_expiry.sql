-- Se saca el cron que vencía automáticamente las inscripciones pendientes de
-- pago (app/api/cron/expire-registrations, ya eliminado): muchos inscriptos
-- que sí habían pagado tardaban en mandar el comprobante y quedaban
-- marcados como 'expired' por error. El control real de quién pagó lo hace
-- el admin a mano desde Inscripciones.
--
-- 'expired' se deja como valor válido del enum registration_status (no se
-- puede sacar sin recrear el tipo, y no vale la pena el riesgo) pero deja
-- de ser alcanzable desde la app: nada más lo escribe.
update public.registrations
  set status = 'pending_payment'
  where status = 'expired';

alter table public.events drop column pending_payment_expiry_days;
