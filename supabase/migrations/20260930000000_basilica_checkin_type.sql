-- "Fue a la Basílica": en Luján (última parada de la ida), el referente
-- marca quién visitó la Basílica. Mismo mecanismo que "Sigue en Micro": un
-- tipo de evento más en la tabla de asistencia, con la misma idempotencia
-- por persona/parada/tipo.
alter type public.checkin_event_type add value 'basilica';
