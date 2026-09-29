-- Primera parada que marca cada punto de partida: el grupo que sale desde
-- Gral. Rodríguez no pasa por Merlo ni La Reja, así que su referente no
-- debería ver esas paradas. Se ven la(s) parada(s) de presentación siempre,
-- más esta parada y todas las siguientes. Null = todas las paradas (el
-- comportamiento de antes, y el de Liniers).
alter table public.starting_points
  add column first_stop_id uuid references public.stops(id) on delete set null;
