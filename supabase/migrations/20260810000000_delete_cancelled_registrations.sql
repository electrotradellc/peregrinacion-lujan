-- Permite borrar definitivamente una inscripción, pero solo si ya está
-- cancelada — evita que un delete accidental se lleve puestos datos de
-- alguien activo/pendiente/confirmado. Las tablas dependientes
-- (bus_assignments, attendance_checkins, payments) ya tienen ON DELETE
-- CASCADE, así que se limpian solas.
grant delete on public.registrations to authenticated;

create policy "registrations_admin_delete_cancelled" on public.registrations for delete
  using (public.is_admin() and status = 'cancelled');
