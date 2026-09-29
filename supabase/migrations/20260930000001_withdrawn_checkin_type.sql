-- "Se retiró": el peregrino deja la peregrinación en una parada y vuelve por
-- sus medios. Se registra como una marca más (parada, hora y quién la hizo)
-- en vez de cancelar la inscripción: en las paradas anteriores tiene que
-- seguir figurando lo que caminó, y en las siguientes y en la Vuelta deja de
-- contarse como "no llegó".
alter type public.checkin_event_type add value 'withdrawn';
