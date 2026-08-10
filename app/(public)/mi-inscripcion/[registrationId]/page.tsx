import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyMagicToken } from "@/lib/magicLink";
import type {
  RegistrationRow,
  EventRow,
  StartingPointRow,
  BusAssignmentRow,
  BusRow,
  BusCaptainAssignmentRow,
  ProfileRow,
} from "@/lib/types";

const statusLabel: Record<string, string> = {
  pending_payment: "Pendiente de pago",
  confirmed: "Confirmada",
  payment_failed: "Pago fallido",
  expired: "Expirada",
  cancelled: "Cancelada",
};

function whatsappLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export default async function MiInscripcionPage({
  params,
  searchParams,
}: {
  params: Promise<{ registrationId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { registrationId } = await params;
  const { token } = await searchParams;

  if (!verifyMagicToken(registrationId, token)) notFound();

  const supabase = createAdminClient();
  const { data: registration } = await supabase
    .from("registrations")
    .select("*")
    .eq("id", registrationId)
    .single<RegistrationRow>();
  if (!registration) notFound();

  const [{ data: event }, { data: startingPoint }, { data: assignment }] = await Promise.all([
    supabase.from("events").select("*").eq("id", registration.event_id).single<EventRow>(),
    supabase
      .from("starting_points")
      .select("*")
      .eq("id", registration.starting_point_id)
      .single<StartingPointRow>(),
    supabase
      .from("bus_assignments")
      .select("*")
      .eq("registration_id", registrationId)
      .eq("direction", "outbound")
      .maybeSingle<BusAssignmentRow>(),
  ]);

  let bus: BusRow | null = null;
  let captainWhatsapp: string | null = null;
  if (assignment) {
    const { data: busRow } = await supabase
      .from("buses")
      .select("*")
      .eq("id", assignment.bus_id)
      .single<BusRow>();
    bus = busRow;

    const { data: captainAssignment } = await supabase
      .from("bus_captain_assignments")
      .select("*")
      .eq("bus_id", assignment.bus_id)
      .maybeSingle<BusCaptainAssignmentRow>();
    if (captainAssignment) {
      const { data: captainProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", captainAssignment.profile_id)
        .single<ProfileRow>();
      captainWhatsapp = (captainProfile as ProfileRow | null)?.whatsapp_phone ?? null;
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold">
        {registration.first_name} {registration.last_name}
      </h1>
      <p className="mt-1 text-neutral-600">{event?.name}</p>

      <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-4">
        <p className="text-sm">
          Estado: <strong>{statusLabel[registration.status]}</strong>
        </p>
        {startingPoint && (
          <p className="mt-1 text-sm text-neutral-600">
            Salís caminando desde <strong>{startingPoint.name}</strong> — presentarte{" "}
            {startingPoint.presentation_time.slice(0, 5)}hs en {startingPoint.presentation_location}.
          </p>
        )}
        {bus ? (
          <p className="mt-1 text-sm text-neutral-600">
            Micro asignado (ida): <strong>Micro {bus.bus_number}</strong>
          </p>
        ) : (
          registration.status === "confirmed" && (
            <p className="mt-1 text-sm text-neutral-500">
              Todavía no te asignaron un micro — te va a aparecer acá.
            </p>
          )
        )}
      </div>

      {registration.status === "confirmed" && (
        <div className="mt-4 flex flex-col gap-3">
          {captainWhatsapp && (
            <a
              href={whatsappLink(
                captainWhatsapp,
                `Hola, soy ${registration.first_name} ${registration.last_name}, voy en el micro ${bus?.bus_number}`,
              )}
              target="_blank"
              className="rounded-md bg-green-600 px-4 py-2 text-center text-sm font-semibold text-white"
            >
              Chatear con tu referente por WhatsApp
            </a>
          )}
          {event?.whatsapp_group_invite_url && (
            <a
              href={event.whatsapp_group_invite_url}
              target="_blank"
              className="rounded-md border border-neutral-300 px-4 py-2 text-center text-sm font-semibold"
            >
              Sumate al grupo de WhatsApp
            </a>
          )}
          <Link
            href={`/info/${registration.event_id}`}
            className="rounded-md border border-neutral-300 px-4 py-2 text-center text-sm font-semibold"
          >
            Ver mapa de paradas y recomendaciones
          </Link>
        </div>
      )}
    </main>
  );
}
