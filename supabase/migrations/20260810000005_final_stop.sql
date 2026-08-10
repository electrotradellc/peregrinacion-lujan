-- La parada final (Luján) es donde a veces alguien recién ahí define si
-- vuelve por sus propios medios o no. Se marca con la misma bandera que la
-- parada de presentación, para el mismo tipo de uso puntual en la app.
alter table public.stops
  add column is_final_stop boolean not null default false;
