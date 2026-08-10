import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import type { EventRow, StopRow } from "@/lib/types";

export default async function InfoPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single<EventRow>();
  if (!event) notFound();

  const { data: stops } = await supabase
    .from("stops")
    .select("*")
    .eq("event_id", eventId)
    .order("sequence_order")
    .returns<StopRow[]>();

  return (
    <main className="mx-auto max-w-xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{event.name}</h1>
        <p className="text-neutral-600">Paradas y recomendaciones para la caminata.</p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Paradas</h2>
        <ol className="space-y-2">
          {(stops ?? []).map((stop) => (
            <li
              key={stop.id}
              className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3"
            >
              <span>
                {stop.sequence_order}. {stop.name}
              </span>
              {stop.maps_url && (
                <a
                  href={stop.maps_url}
                  target="_blank"
                  className="text-sm text-blue-700 underline"
                >
                  Ver en Maps
                </a>
              )}
            </li>
          ))}
        </ol>
      </section>

      {event.whatsapp_group_invite_url && (
        <a
          href={event.whatsapp_group_invite_url}
          target="_blank"
          className="block rounded-md bg-green-600 px-4 py-2 text-center text-sm font-semibold text-white"
        >
          Sumate al grupo de WhatsApp
        </a>
      )}

      {event.walking_recommendations && (
        <section className="prose prose-sm max-w-none rounded-lg border border-neutral-200 bg-white p-4">
          <ReactMarkdown>{event.walking_recommendations}</ReactMarkdown>
        </section>
      )}
    </main>
  );
}
