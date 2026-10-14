-- Un micro de vuelta que ya salió se puede seguir corrigiendo (sumar, sacar o
-- mover gente): "Salió" solo lo marca como cerrado y lo guarda con su hora.
-- El control de cupo se mantiene, y sigue bloqueando la fila del micro mientras
-- cuenta para que dos asignaciones a la vez no se pasen.
create or replace function public.enforce_return_bus_capacity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  bus public.return_buses%rowtype;
  taken int;
begin
  select * into bus from public.return_buses where id = new.return_bus_id for update;
  select count(*) into taken from public.return_assignments
    where return_bus_id = new.return_bus_id and id is distinct from new.id;
  if taken >= bus.capacity then
    raise exception 'El micro % está completo', bus.bus_number;
  end if;
  return new;
end;
$$;
