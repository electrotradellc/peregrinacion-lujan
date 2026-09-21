import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCapacityByStartingPoint } from "@/lib/capacity";
import type { EventRow, StartingPointRow, WaitlistEntryRow } from "@/lib/types";
import { inviteWaitlistAction, cancelWaitlistEntryAction } from "./actions";

const waitlistStatusLabel: Record<string, string> = {
  waiting: "Esperando",
  invited: "Invitado/a",
  completed: "Completó inscripción",
  cancelled: "Cancelado",
};

const waitlistStatusClass: Record<string, string> = {
  waiting: "bg-amber-100 text-amber-800",
  invited: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-neutral-200 text-neutral-600",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export default async function ListaEsperaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: event }, { data: startingPoints }, { data: entriesRaw }] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).single<EventRow>(),
    supabase.from("starting_points").select("*").eq("event_id", id).order("name").returns<StartingPointRow[]>(),
    supabase
      .from("waitlist_entries")
      .select("*")
      .eq("event_id", id)
      .order("created_at", { ascending: true })
      .returns<WaitlistEntryRow[]>(),
  ]);

  if (!event) notFound();

  const capacityByStartingPoint = await getCapacityByStartingPoint(supabase, id);
  const entries = entriesRaw ?? [];

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Lista de espera — {event.name}</h1>
      <p className="text-sm text-neutral-600">
        Gente que se anotó porque no quedaban cupos en su punto de partida. Si agregás o agrandás
        un micro en Config, volvé acá y notificá a los primeros de la cola — les llega un email
        con un link a la inscripción, ya con sus datos precargados.
      </p>

      {(startingPoints ?? []).map((sp) => {
        const spEntries = entries.filter((e) => e.starting_point_id === sp.id);
        const waiting = spEntries.filter((e) => e.status === "waiting");
        const capacity = capacityByStartingPoint[sp.id];
        const remaining = capacity?.remaining ?? null;

        return (
          <section key={sp.id} className="rounded-lg border border-neutral-200 bg-white p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">{sp.name}</h2>
              <div className="flex items-center gap-2 text-sm">
                <span className="rounded-full bg-neutral-100 px-3 py-1 font-medium text-neutral-700">
                  {waiting.length} esperando
                </span>
                <span
                  className={`rounded-full px-3 py-1 font-medium ${
                    remaining === null
                      ? "bg-neutral-100 text-neutral-600"
                      : remaining > 0
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                  }`}
                >
                  {remaining === null ? "Sin tope configurado" : `${remaining} cupo${remaining === 1 ? "" : "s"} libre${remaining === 1 ? "" : "s"} ahora`}
                </span>
              </div>
            </div>

            {waiting.length > 0 && (
              <form
                action={inviteWaitlistAction.bind(null, id, sp.id)}
                className="flex flex-wrap items-end gap-3 rounded-md bg-neutral-50 p-3"
              >
                <div>
                  <label className="block text-xs font-medium text-neutral-600">
                    Notificar a los primeros
                  </label>
                  <input
                    name="count"
                    type="number"
                    min="1"
                    max={waiting.length}
                    defaultValue={Math.max(1, Math.min(remaining ?? waiting.length, waiting.length))}
                    className="mt-1 w-20 rounded-md border border-neutral-300 px-2 py-1 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-md bg-brand-ink px-3 py-1.5 text-sm font-semibold text-white"
                >
                  Notificar
                </button>
                <span className="text-xs text-neutral-500">
                  En orden de llegada a la lista. No hace falta que coincida con los cupos libres
                  de arriba — vos decidís cuántos avisar.
                </span>
              </form>
            )}

            {spEntries.length === 0 ? (
              <p className="text-sm text-neutral-500">Nadie anotado en este punto de partida.</p>
            ) : (
              <ul className="divide-y divide-neutral-100 text-sm">
                {spEntries.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div>
                      <span className="font-medium">
                        {entry.first_name} {entry.last_name}
                      </span>{" "}
                      <span className="text-neutral-500">
                        — DNI {entry.dni} — {entry.phone} — {entry.email}
                      </span>
                      <div className="text-xs text-neutral-400">
                        Anotado {formatDateTime(entry.created_at)}
                        {entry.invited_at && <> · Invitado {formatDateTime(entry.invited_at)}</>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${waitlistStatusClass[entry.status]}`}
                      >
                        {waitlistStatusLabel[entry.status]}
                      </span>
                      {(entry.status === "waiting" || entry.status === "invited") && (
                        <form action={cancelWaitlistEntryAction.bind(null, id, entry.id)}>
                          <button className="text-xs text-red-600 hover:underline">Cancelar</button>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
