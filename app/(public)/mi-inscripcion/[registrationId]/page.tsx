import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
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

const cardClass = "w-full bg-white rounded-3xl shadow-sm p-5 flex flex-col gap-4";

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

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

  const assignmentsConfirmed = Boolean(event?.bus_assignments_confirmed_at);

  let bus: BusRow | null = null;
  let captainWhatsapp: string | null = null;
  let captainName: string | null = null;
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
      captainName = (captainProfile as ProfileRow | null)?.full_name ?? null;
    }
  }

  const eventYear = event ? new Date(event.event_date + "T00:00:00").getFullYear() : "";
  const pilgrimCode = registration.pilgrim_code ? `#LUJAN${eventYear}-${registration.pilgrim_code}` : null;

  const statusStyle: Record<string, { bg: string; text: string; icon: string; label: string }> = {
    pending_payment: { bg: "bg-warning-bg", text: "text-warning", icon: "hourglass_top", label: "PENDIENTE DE PAGO" },
    confirmed: { bg: "bg-success-bg", text: "text-success", icon: "verified", label: "INSCRIPCIÓN CONFIRMADA" },
    cancelled: { bg: "bg-neutral-100", text: "text-neutral-600", icon: "cancel", label: "CANCELADA" },
  };
  const currentStatus = statusStyle[registration.status] ?? statusStyle.pending_payment;

  return (
    <main className="mx-auto max-w-xl px-4 py-8 bg-canvas flex flex-col gap-5">
      {/* Cápsula de identidad de la parroquia */}
      <div className="w-full flex items-center justify-between bg-white rounded-2xl p-3 shadow-sm">
        <Image src="/logo.png" alt="Parroquia San Isidro Labrador" width={424} height={186} className="max-h-10 w-auto object-contain" />
        <div className="flex flex-col items-end justify-center text-right pl-2">
          <span className="text-[11px] text-terracotta font-bold tracking-tight">Sirviendo en</span>
          <span className="text-[11px] text-terracotta font-extrabold uppercase tracking-wider">Comunidad</span>
        </div>
      </div>

      {/* Credencial principal */}
      <section className={cardClass}>
        <div className="w-full flex items-center justify-between">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${currentStatus.bg} ${currentStatus.text}`}>
            <Icon name={currentStatus.icon} className="text-[18px]" />
            <span className="text-xs font-bold tracking-wide">{currentStatus.label}</span>
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">
            Peregrino Registrado
          </span>
          <h1 className="text-2xl font-extrabold text-neutral-900">
            {registration.first_name} {registration.last_name}
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {pilgrimCode && (
              <span className="text-sm text-terracotta font-bold tracking-tight">{pilgrimCode}</span>
            )}
            <span className="px-2 py-0.5 rounded-md bg-mist text-terracotta text-xs font-semibold">
              DNI: {registration.dni}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-mist">
          <div className="w-10 h-10 rounded-full bg-terracotta text-white flex items-center justify-center flex-shrink-0">
            <Icon name="church" className="text-[22px]" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-terracotta truncate">{event?.name}</span>
            {event && (
              <span className="text-xs text-neutral-500 flex items-center gap-1">
                <Icon name="calendar_today" className="text-[15px]" />
                {new Date(event.event_date + "T00:00:00").toLocaleDateString("es-AR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Punto de salida + micro asignado */}
      <section className={cardClass}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand text-brand-ink flex items-center justify-center">
            <Icon name="directions_bus" className="text-[20px]" />
          </div>
          <h2 className="text-lg font-semibold text-neutral-900">Salida y Micro</h2>
        </div>
        <div className="p-4 rounded-xl bg-neutral-50 flex flex-col gap-3">
          {startingPoint && (
            <div className="flex items-start gap-2">
              <Icon name="location_on" className="text-terracotta text-[20px] mt-0.5" />
              <div className="flex flex-col">
                <span className="font-bold text-sm text-neutral-900">Punto de salida:</span>
                <span className="text-sm text-brand-ink font-medium">{startingPoint.name}</span>
                <span className="text-xs text-neutral-500">
                  Presentarte {startingPoint.presentation_time.slice(0, 5)}hs en{" "}
                  {startingPoint.presentation_location}
                </span>
              </div>
            </div>
          )}
          {bus && assignmentsConfirmed ? (
            <div className="flex items-center justify-between pt-2 border-t border-neutral-200">
              <div className="flex flex-col">
                <span className="text-xs text-neutral-500 font-medium">Unidad asignada</span>
                <span className="text-xl font-bold text-brand-ink">Micro N° {bus.bus_number}</span>
              </div>
              {captainName && (
                <div className="flex flex-col items-end">
                  <span className="text-xs text-neutral-500 font-medium">Capitán a cargo</span>
                  <span className="text-sm font-bold text-neutral-900">{captainName}</span>
                </div>
              )}
            </div>
          ) : (
            registration.status === "confirmed" && (
              <p className="text-xs text-neutral-500 pt-2 border-t border-neutral-200">
                Todavía estamos terminando de armar la lista de micros — en cuanto esté lista vas
                a ver acá tu micro asignado.
              </p>
            )
          )}
        </div>
        {assignmentsConfirmed && captainWhatsapp && (
          <a
            className="w-full min-h-[48px] rounded-full bg-success text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm hover:opacity-95 active:scale-[0.985] transition-all"
            href={whatsappLink(
              captainWhatsapp,
              `Hola, soy ${registration.first_name} ${registration.last_name}, voy en el micro ${bus?.bus_number}`,
            )}
            target="_blank"
          >
            <Icon name="chat" className="text-[20px]" />
            Contactar a mi Capitán de Micro (WhatsApp)
          </a>
        )}
      </section>

      {/* Cómo pagar */}
      {registration.status === "pending_payment" && (
        <section className={cardClass}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-warning-bg text-warning flex items-center justify-center">
              <Icon name="receipt_long" className="text-[20px]" />
            </div>
            <h2 className="text-lg font-semibold text-neutral-900">Cómo pagar</h2>
          </div>
          <div className="flex justify-between items-baseline p-3 rounded-xl bg-mist">
            <span className="text-xs text-neutral-500">Monto a abonar</span>
            <span className="text-xl font-extrabold text-terracotta">
              ${event?.registration_price_ars.toLocaleString("es-AR")}
            </span>
          </div>
          {event?.payment_alias && (
            <p className="text-sm text-neutral-700">
              Alias para transferencia: <strong>{event.payment_alias}</strong>
            </p>
          )}
          {event?.payment_instructions && (
            <div className="prose prose-sm max-w-none text-neutral-700">
              <ReactMarkdown>{event.payment_instructions}</ReactMarkdown>
            </div>
          )}
          {event?.contact_email && (
            <p className="text-sm text-neutral-700">
              Después de pagar, mandanos el comprobante a{" "}
              <a href={`mailto:${event.contact_email}`} className="underline text-brand-ink">
                {event.contact_email}
              </a>
              .
            </p>
          )}
          <p className="text-xs text-neutral-500">
            Tu inscripción queda pendiente hasta que confirmemos el pago — te va a cambiar de
            estado en esta misma página cuando lo hagamos.
          </p>
        </section>
      )}

      {/* Accesos rápidos */}
      {registration.status === "confirmed" && (
        <section className="flex flex-col gap-3">
          {assignmentsConfirmed && event?.captains_coordinator_whatsapp && (
            <a
              href={whatsappLink(
                event.captains_coordinator_whatsapp,
                `Hola, soy ${registration.first_name} ${registration.last_name}, inscripto en la peregrinación`,
              )}
              target="_blank"
              className="w-full h-12 rounded-full border border-success text-success font-semibold text-sm flex items-center justify-center gap-2"
            >
              <Icon name="support_agent" className="text-[20px]" />
              Chatear con {event.captains_coordinator_name || "el coordinador de capitanes"}
            </a>
          )}
          {event?.whatsapp_group_invite_url && (
            <a
              href={event.whatsapp_group_invite_url}
              target="_blank"
              className="w-full h-12 rounded-full border border-neutral-200 text-neutral-700 font-semibold text-sm flex items-center justify-center gap-2"
            >
              <Icon name="groups" className="text-[20px]" />
              Sumate al grupo de WhatsApp
            </a>
          )}
          <Link
            href={`/info/${registration.event_id}`}
            className="w-full h-12 rounded-full bg-mist text-terracotta font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all"
          >
            <Icon name="map" className="text-[20px]" />
            Ver paradas y recomendaciones para la caminata
          </Link>
        </section>
      )}

      <footer className="pt-2 flex flex-col items-center gap-3">
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
          <Link href="/recuperar" className="text-brand-ink hover:text-brand-ink-hover underline underline-offset-4">
            ¿Ya te inscribiste? Recuperar mi link
          </Link>
          <span className="text-neutral-300">•</span>
          <Link href="/login" className="text-neutral-500 hover:text-terracotta">
            Acceso para organizadores
          </Link>
        </div>
        <p className="text-xs text-neutral-400 text-center">
          Parroquia San Isidro Labrador • Peregrinación a Luján
        </p>
      </footer>
    </main>
  );
}
