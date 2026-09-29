import type { StopRow } from "@/lib/types";

// Paradas que le corresponden a un grupo según su punto de partida: siempre
// la(s) de presentación (la Parroquia), más la primera parada que marca ese
// grupo y todas las siguientes. Sin primera parada configurada, todas.
export function stopsForStartingPoint(stops: StopRow[], firstStopId: string | null | undefined): StopRow[] {
  const first = firstStopId ? stops.find((s) => s.id === firstStopId) : undefined;
  if (!first) return stops;
  return stops.filter((s) => s.is_presentation_stop || s.sequence_order >= first.sequence_order);
}
