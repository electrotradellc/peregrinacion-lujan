-- Modo "inscripción solo por invitación": cuando está activo, /registro deja
-- de aceptar inscripciones directas — solo entra quien llega con un link de
-- invitación de lista de espera válido (mismo mecanismo que ya existía para
-- cuando se liberaba un cupo puntual, ahora aplicable a todo el evento).
-- Apagado por defecto para no cambiar el comportamiento de ningún evento
-- existente ni de los que se creen de acá en adelante sin tocarlo a mano.
alter table public.events
  add column registration_invite_only boolean not null default false;
