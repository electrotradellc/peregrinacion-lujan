import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/types";

const statusLabel: Record<string, string> = {
  draft: "Borrador",
  open: "Inscripción abierta",
  closed: "Cerrado",
  archived: "Archivado",
};

export default async function EventosPage() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: false })
    .returns<EventRow[]>();

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Eventos</h1>
          <p className="text-sm text-neutral-600">
            Cada peregrinación es un evento configurable: fecha, micros, paradas y puntos de
            partida propios.
          </p>
        </div>
        <Link
          href="/admin/eventos/nuevo"
          className="shrink-0 rounded-md bg-brand-ink px-4 py-2 text-sm font-semibold text-white"
        >
          + Nuevo
        </Link>
      </div>

      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
        {(events ?? []).map((event) => (
          <li key={event.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <Link
                href={`/admin/eventos/${event.id}/inscripciones`}
                className="font-medium text-neutral-900 hover:underline"
              >
                {event.name}
              </Link>
              <p className="text-sm text-neutral-500">
                {event.event_date} · {statusLabel[event.status]}
              </p>
            </div>
            <Link
              href={`/admin/eventos/${event.id}/config`}
              className="text-sm text-neutral-600 hover:underline"
            >
              Configurar
            </Link>
          </li>
        ))}
        {(events ?? []).length === 0 && (
          <li className="px-4 py-6 text-sm text-neutral-500">Todavía no hay eventos creados.</li>
        )}
      </ul>
    </div>
  );
}
