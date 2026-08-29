import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EventRow, StartingPointRow } from "@/lib/types";
import { RegistrationForm } from "@/components/registration/RegistrationForm";

export default async function RegistroPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single<EventRow>();

  if (!event) notFound();

  if (event.status !== "open") {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">{event.name}</h1>
        <p className="mt-4 text-neutral-600">
          {event.status === "draft"
            ? "La inscripción todavía no está abierta. Volvé a intentarlo más adelante."
            : "La inscripción para este evento ya está cerrada."}
        </p>
        <div className="mt-8 flex justify-center gap-4 text-xs text-neutral-400">
          <Link href="/recuperar" className="hover:text-neutral-600">
            ¿Ya te inscribiste? Recuperar mi link
          </Link>
          <Link href="/login" className="hover:text-neutral-600">
            Acceso para organizadores
          </Link>
        </div>
      </main>
    );
  }

  const { data: startingPoints } = await supabase
    .from("starting_points")
    .select("*")
    .eq("event_id", eventId)
    .order("name")
    .returns<StartingPointRow[]>();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8 flex flex-col items-center text-center">
        <Image src="/logo.png" alt="Parroquia San Isidro Labrador" width={424} height={186} className="mb-6 h-auto w-40" priority />
        <h1 className="text-2xl font-semibold">{event.name}</h1>
        <p className="mt-1 text-neutral-600">
          {new Date(event.event_date + "T00:00:00").toLocaleDateString("es-AR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}{" "}
          · Inscripción: ${event.registration_price_ars.toLocaleString("es-AR")}
        </p>
      </header>

      <RegistrationForm
        event={event}
        startingPoints={startingPoints ?? []}
      />

      <footer className="mt-10 flex justify-center gap-4 text-xs text-neutral-400">
        <Link href="/recuperar" className="hover:text-neutral-600">
          ¿Ya te inscribiste? Recuperar mi link
        </Link>
        <Link href="/login" className="hover:text-neutral-600">
          Acceso para organizadores
        </Link>
      </footer>
    </main>
  );
}
