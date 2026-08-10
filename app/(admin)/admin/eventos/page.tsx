import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/types";
import { createEventAction } from "./actions";

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
      <div>
        <h1 className="text-xl font-semibold">Eventos</h1>
        <p className="text-sm text-neutral-600">
          Cada peregrinación es un evento configurable: fecha, micros, paradas y puntos de
          partida propios.
        </p>
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

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-4 font-semibold">Nuevo evento</h2>
        <form action={createEventAction} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium">Nombre</label>
            <input
              name="name"
              required
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Fecha</label>
            <input
              name="event_date"
              type="date"
              required
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Precio (ARS)</label>
            <input
              name="registration_price_ars"
              type="number"
              min="0"
              step="0.01"
              required
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Crear evento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
