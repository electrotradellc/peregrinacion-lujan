-- Permite a un capitán deshacer una marca de llegada/salida de su propio
-- micro, no solo al admin (attendance_checkins_admin_delete). Simétrico al
-- alcance de attendance_checkins_insert: cualquier capitán del micro puede
-- corregir, no solo quien la marcó — un solo capitán suele cubrir varias
-- paradas y puede necesitar corregir lo que cargó otro compañero.
create policy "attendance_checkins_captain_delete" on public.attendance_checkins for delete
  using (public.is_captain_of_bus(bus_id));
