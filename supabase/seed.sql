-- Datos del evento real: Peregrinación a Luján, sábado 3 de octubre de 2026.
-- Pensado para correr una sola vez contra un proyecto recién migrado
-- (`supabase db reset` lo corre automáticamente después de las migraciones).

do $$
declare
  v_event_id uuid;
  v_sp_liniers uuid;
  v_sp_gral_rodriguez uuid;
begin
  insert into public.events (
    name, event_date, registration_price_ars, status,
    walking_recommendations, terms_and_conditions, terms_version,
    registration_opens_at, registration_closes_at
  ) values (
    'Peregrinación a Luján 2026',
    '2026-10-03',
    15000.00,
    'draft',
    E'# Recomendaciones para la caminata\n\n'
    '- Llevá calzado cómodo y ya usado, no estrenes zapatillas ese día.\n'
    '- Hidratate durante todo el trayecto, no esperes a tener sed.\n'
    '- Usá protector solar, gorra y ropa liviana.\n'
    '- Llevá algo para comer en el camino (frutas, barritas de cereal).\n'
    '- Si tomás medicación habitual, llevala con vos.\n'
    '- Avisá a tu referente de micro ante cualquier molestia, por menor que parezca.',
    E'Términos y condiciones de la Peregrinación a Luján 2026.\n\n'
    '1. La inscripción es personal e intransferible.\n'
    '2. El pago confirma la inscripción; sin pago la inscripción queda pendiente y puede expirar.\n'
    '3. Los organizadores no se responsabilizan por objetos personales perdidos durante la caminata.\n'
    '4. La información médica declarada será utilizada exclusivamente para asistencia en caso de emergencia.\n'
    '5. Es obligatorio presentarse en el horario y lugar indicado según el punto de partida elegido.',
    '1',
    now(),
    '2026-09-28 23:59:00-03'
  )
  returning id into v_event_id;

  insert into public.starting_points (event_id, name, presentation_time, presentation_location)
  values (v_event_id, 'Liniers', '07:00', 'Parroquia San Isidro Labrador')
  returning id into v_sp_liniers;

  insert into public.starting_points (event_id, name, presentation_time, presentation_location)
  values (v_event_id, 'Gral. Rodríguez', '17:30', 'A confirmar')
  returning id into v_sp_gral_rodriguez;

  -- 5 micros de arranque: ajustar cantidad libremente desde /admin más adelante
  insert into public.buses (event_id, starting_point_id, bus_number, capacity)
  select v_event_id, v_sp_liniers, n, 40
  from generate_series(1, 3) as n;

  insert into public.buses (event_id, starting_point_id, bus_number, capacity)
  select v_event_id, v_sp_gral_rodriguez, n, 40
  from generate_series(4, 5) as n;

  insert into public.stops (event_id, sequence_order, name, maps_url) values
    (v_event_id, 1, 'Merlo', 'https://maps.google.com/?q=Merlo,+Buenos+Aires'),
    (v_event_id, 2, 'La Reja', 'https://maps.google.com/?q=La+Reja,+Buenos+Aires'),
    (v_event_id, 3, 'Gral. Rodríguez', 'https://maps.google.com/?q=General+Rodriguez,+Buenos+Aires'),
    (v_event_id, 4, 'Luján', 'https://maps.google.com/?q=Basilica+de+Lujan');
end $$;
