-- Se decidió no usar esta bandera (el toggle de "vuelve por su cuenta" va
-- solo en la lista de Inscripciones, no en la parada de Luján).
alter table public.stops drop column is_final_stop;
