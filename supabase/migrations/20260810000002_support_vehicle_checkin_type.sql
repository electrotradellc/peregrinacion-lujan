-- "Sigue en Micro": el micro de apoyo sin numerar que acompaña toda la
-- peregrinación para llevar a quien ya no puede seguir caminando. Se
-- registra como un tercer tipo de evento en la misma tabla de asistencia
-- (mismo mecanismo de idempotencia, misma parada/hora), no como una
-- asignación de micro nueva.
alter type public.checkin_event_type add value 'support_vehicle';
