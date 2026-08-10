-- Habilita Realtime sobre attendance_checkins para el dashboard en vivo de
-- /admin/eventos/[id]/asistencia (Supabase Realtime solo transmite cambios
-- de tablas explícitamente agregadas a esta publicación).
alter publication supabase_realtime add table public.attendance_checkins;
