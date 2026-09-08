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
      <main className="mx-auto max-w-xl px-4 py-16 text-center bg-canvas">
        <Image src="/logo.png" alt="Parroquia San Isidro Labrador" width={424} height={186} className="mx-auto mb-6 h-auto w-32" />
        <h1 className="text-2xl font-semibold text-brand-ink">{event.name}</h1>
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

  const serviceChips = [
    { icon: "directions_bus", label: "Micro de apoyo" },
    { icon: "water_drop", label: "Hidratación" },
    { icon: "medical_services", label: "Sanidad" },
    { icon: "restaurant", label: "Comida" },
    { icon: "wc", label: "Baños" },
  ];

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 bg-canvas">
      <section className="relative overflow-hidden rounded-3xl bg-mist p-5 md:p-6 shadow-sm mb-6">
        <div className="relative z-10 flex flex-col gap-4">
          <div className="inline-flex items-center justify-between gap-3 bg-white px-4 py-2.5 rounded-full shadow-sm w-full max-w-sm">
            <Image
              src="/logo.png"
              alt="Parroquia San Isidro Labrador"
              width={424}
              height={186}
              className="h-12 w-auto object-contain"
              priority
            />
            <div className="w-px h-10 bg-neutral-200 shrink-0" />
            <span className="text-[11px] font-bold text-terracotta uppercase tracking-wide leading-tight text-right flex-1">
              Sirviendo en Comunidad
            </span>
          </div>
          <div>
            <h1 className="text-[26px] font-extrabold text-brand-ink leading-tight">{event.name}</h1>
            <div className="flex items-center gap-2 mt-1 text-neutral-600 text-sm font-medium">
              <span className="material-symbols-outlined text-terracotta text-[20px]">calendar_month</span>
              <span>
                {new Date(event.event_date + "T00:00:00").toLocaleDateString("es-AR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs text-neutral-500 block">Costo de Inscripción</span>
              <div className="flex items-baseline gap-2">
                <span className="text-[26px] font-extrabold text-terracotta">
                  ${event.registration_price_ars.toLocaleString("es-AR")}
                </span>
                <span className="text-xs text-success font-semibold">Valor único</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1 sm:pt-0">
              {serviceChips.map((chip) => (
                <span
                  key={chip.label}
                  className="inline-flex items-center gap-1 bg-neutral-50 px-2 py-1 rounded-full text-[11px] font-bold text-brand-ink"
                >
                  <span className="material-symbols-outlined text-[14px]">{chip.icon}</span>
                  {chip.label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-start gap-3 bg-white/70 p-3 rounded-2xl">
            <span className="material-symbols-outlined text-terracotta text-[20px] shrink-0 mt-0.5">favorite</span>
            <p className="text-sm text-neutral-700 leading-relaxed">
              Caminamos juntos, nos cuidamos en comunidad. Por favor completá tus datos con
              tranquilidad; cada paso está acompañado por nuestros servidores y equipo de apoyo.
            </p>
          </div>
        </div>
      </section>

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
