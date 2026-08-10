import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/types";

// Punto de entrada público único y estable: siempre manda al evento con
// inscripción abierta en este momento, sin que nadie tenga que compartir un
// link con el UUID del evento. Si no hay ninguno abierto, muestra un
// mensaje en vez de la home de Next.js por defecto.
export default async function Home() {
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("status", "open")
    .order("event_date", { ascending: true })
    .limit(1)
    .maybeSingle<EventRow>();

  if (event) {
    redirect(`/registro/${event.id}`);
  }

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <Image src="/logo.png" alt="Parroquia San Isidro Labrador" width={424} height={186} className="mb-8 h-auto w-56" priority />
      <h1 className="text-xl font-semibold">No hay ninguna inscripción abierta</h1>
      <p className="mt-2 text-sm text-neutral-600">
        En este momento no hay ninguna peregrinación con inscripción abierta. Volvé a
        intentarlo más adelante.
      </p>
      <Link href="/login" className="mt-8 text-xs text-neutral-400 hover:text-neutral-600">
        Acceso para organizadores
      </Link>
    </main>
  );
}
