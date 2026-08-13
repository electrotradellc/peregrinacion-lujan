import Image from "next/image";
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
        <Image src="/logo.png" alt="Parroquia San Isidro Labrador" width={424} height={186} className="mb-6 h-auto w-32" />
        <h1 className="text-2xl font-semibold">{event.name}</h1>
        <p className="text-neutral-600">Paradas y recomendaciones para la caminata.</p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Paradas</h2>
        <ol className="space-y-2">
          {(stops ?? []).map((stop) => (
            <li
              key={stop.id}
              className="rounded-lg border border-neutral-200 bg-white px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">
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
              </div>
              {(stop.location_description || stop.expected_time) && (
                <p className="mt-1 text-sm text-neutral-600">
                  {stop.location_description}
                  {stop.location_description && stop.expected_time && " · "}
                  {stop.expected_time && `Hora estimada: ${stop.expected_time.slice(0, 5)}hs`}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>

      {(event.whatsapp_group_invite_url || event.contact_email) && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Contacto</h2>
          {event.whatsapp_group_invite_url && (
            <a
              href={event.whatsapp_group_invite_url}
              target="_blank"
              className="block rounded-md bg-green-600 px-4 py-2 text-center text-sm font-semibold text-white"
            >
              Sumate al grupo de WhatsApp
            </a>
          )}
          {event.contact_email && (
            <a
              href={`mailto:${event.contact_email}`}
              className="block rounded-md border border-neutral-300 px-4 py-2 text-center text-sm font-semibold text-neutral-700"
            >
              Escribinos a {event.contact_email}
            </a>
          )}
        </section>
      )}

      {event.walking_recommendations && (
        <section className="prose prose-sm max-w-none rounded-lg border border-neutral-200 bg-white p-4">
          <ReactMarkdown>{event.walking_recommendations}</ReactMarkdown>
        </section>
      )}
    </main>
  );
}
