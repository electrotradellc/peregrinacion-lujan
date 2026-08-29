import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EventRow, StartingPointRow, BusRow, StopRow, BusCaptainAssignmentRow, ProfileRow } from "@/lib/types";
import { CollapsibleAddForm } from "@/components/admin/CollapsibleAddForm";
import { StopListItem } from "@/components/admin/StopListItem";
import {
  updateEventSettingsAction,
  addStartingPointAction,
  deleteStartingPointAction,
  addBusAction,
  deleteBusAction,
  addStopAction,
  updateStopAction,
  deleteStopAction,
} from "./actions";

const inputClass = "mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm";
const cardClass = "rounded-lg border border-neutral-200 bg-white p-4 space-y-4";

export default async function EventConfigPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const supabase = await createClient();

  const [{ data: event }, { data: startingPoints }, { data: buses }, { data: stops }] =
    await Promise.all([
      supabase.from("events").select("*").eq("id", id).single<EventRow>(),
      supabase
        .from("starting_points")
        .select("*")
        .eq("event_id", id)
        .order("name")
        .returns<StartingPointRow[]>(),
      supabase
        .from("buses")
        .select("*")
        .eq("event_id", id)
        .order("bus_number")
        .returns<BusRow[]>(),
      supabase
        .from("stops")
        .select("*")
        .eq("event_id", id)
        .order("sequence_order")
        .returns<StopRow[]>(),
    ]);

  if (!event) notFound();

  const startingPointName = (spId: string) =>
    startingPoints?.find((sp) => sp.id === spId)?.name ?? "?";

  const { data: captainAssignments } = await supabase
    .from("bus_captain_assignments")
    .select("*")
    .eq("event_id", id)
    .returns<BusCaptainAssignmentRow[]>();

  const captainProfileIds = [...new Set((captainAssignments ?? []).map((a) => a.profile_id))];
  const { data: captainProfiles } = captainProfileIds.length
    ? await supabase.from("profiles").select("*").in("id", captainProfileIds).returns<ProfileRow[]>()
    : { data: [] as ProfileRow[] };

  const captainByBusId = new Map(
    (captainAssignments ?? []).map((a) => [
      a.bus_id,
      captainProfiles?.find((p) => p.id === a.profile_id) ?? null,
    ]),
  );

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Configuración — {event.name}</h1>

      {saved === "1" && (
        <div className="rounded-md bg-green-50 px-4 py-2 text-sm font-medium text-green-800">
          ✓ Cambios guardados
        </div>
      )}

      <section className={cardClass}>
        <h2 className="font-semibold">Datos generales</h2>
        <form action={updateEventSettingsAction.bind(null, id)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium">Nombre</label>
              <input name="name" defaultValue={event.name} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium">Fecha</label>
              <input
                name="event_date"
                type="date"
                defaultValue={event.event_date}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Precio (ARS)</label>
              <input
                name="registration_price_ars"
                type="number"
                min="0"
                step="0.01"
                defaultValue={event.registration_price_ars}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Estado</label>
              <select name="status" defaultValue={event.status} className={inputClass}>
                <option value="draft">Borrador (inscripción cerrada)</option>
                <option value="open">Inscripción abierta</option>
                <option value="closed">Cerrado</option>
                <option value="archived">Archivado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">
                Días para expirar inscripción sin pagar
              </label>
              <input
                name="pending_payment_expiry_days"
                type="number"
                min="1"
                defaultValue={event.pending_payment_expiry_days}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Link del grupo de WhatsApp</label>
              <input
                name="whatsapp_group_invite_url"
                defaultValue={event.whatsapp_group_invite_url ?? ""}
                placeholder="https://chat.whatsapp.com/..."
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Alias para transferencia</label>
              <input
                name="payment_alias"
                defaultValue={event.payment_alias ?? ""}
                placeholder="peregrinacion.sil.mp"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Email de contacto</label>
              <input
                name="contact_email"
                type="email"
                defaultValue={event.contact_email ?? ""}
                placeholder="lujanpsil@gmail.com"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-neutral-500">
                Adonde se pide el comprobante de pago y el reply-to de los emails automáticos.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium">Nombre del coordinador de capitanes</label>
              <input
                name="captains_coordinator_name"
                defaultValue={event.captains_coordinator_name ?? ""}
                placeholder="Ej. Juan Pérez"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">WhatsApp del coordinador de capitanes</label>
              <input
                name="captains_coordinator_whatsapp"
                defaultValue={event.captains_coordinator_whatsapp ?? ""}
                placeholder="+54911..."
                className={inputClass}
              />
              <p className="mt-1 text-xs text-neutral-500">
                Le aparece a cada inscripto confirmado en /mi-inscripcion, junto al whatsapp de
                su propio capitán de micro.
              </p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium">
              Instrucciones de pago (Markdown) — efectivo en Secretaría, a qué mail mandar el
              comprobante, horarios, etc.
            </label>
            <textarea
              name="payment_instructions"
              defaultValue={event.payment_instructions ?? ""}
              rows={5}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">
              Recomendaciones para la caminata (Markdown)
            </label>
            <textarea
              name="walking_recommendations"
              defaultValue={event.walking_recommendations ?? ""}
              rows={6}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="sm:col-span-3">
              <label className="block text-sm font-medium">Términos y Condiciones</label>
              <textarea
                name="terms_and_conditions"
                defaultValue={event.terms_and_conditions}
                rows={8}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Versión de T&C</label>
              <input
                name="terms_version"
                defaultValue={event.terms_version}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-neutral-500">
                Subí este número si cambiás el texto — queda registrado qué versión aceptó
                cada inscripto.
              </p>
            </div>
          </div>
          <button
            type="submit"
            className="rounded-md bg-brand-ink px-4 py-2 text-sm font-semibold text-white"
          >
            Guardar
          </button>
        </form>
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">Puntos de partida</h2>
        <ul className="divide-y divide-neutral-200">
          {(startingPoints ?? []).map((sp) => (
            <li key={sp.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                <strong>{sp.name}</strong> — presentarse {sp.presentation_time.slice(0, 5)}hs en{" "}
                {sp.presentation_location}
              </span>
              <form action={deleteStartingPointAction.bind(null, id, sp.id)}>
                <button className="text-red-600 hover:underline">Eliminar</button>
              </form>
            </li>
          ))}
        </ul>
        <CollapsibleAddForm>
          <form
            action={addStartingPointAction.bind(null, id)}
            className="grid grid-cols-1 gap-3 sm:grid-cols-4"
          >
            <input name="name" placeholder="Nombre (ej. Liniers)" required className={inputClass} />
            <input name="presentation_time" type="time" required className={inputClass} />
            <input
              name="presentation_location"
              placeholder="Lugar de presentación"
              required
              className={inputClass}
            />
            <button className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium">
              Agregar
            </button>
          </form>
        </CollapsibleAddForm>
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">Micros</h2>
        <p className="text-sm text-neutral-600">
          La cantidad de micros es libre — agregá o quitá los que necesites. Cada micro
          pertenece a un único punto de partida. El capitán se asigna desde{" "}
          <a href="/admin/usuarios" className="underline">
            Usuarios
          </a>
          ; acá solo se muestra quién quedó a cargo de cada uno.
        </p>
        <ul className="divide-y divide-neutral-200">
          {(buses ?? []).map((bus) => {
            const captain = captainByBusId.get(bus.id);
            return (
              <li key={bus.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  Micro <strong>{bus.bus_number}</strong> — {startingPointName(bus.starting_point_id)}{" "}
                  — {bus.capacity} lugares
                  <br />
                  <span className="text-xs text-neutral-500">
                    Capitán:{" "}
                    {captain
                      ? `${captain.full_name}${captain.whatsapp_phone ? ` — ${captain.whatsapp_phone}` : " (sin WhatsApp cargado)"}`
                      : "sin asignar"}
                  </span>
                </span>
                <form action={deleteBusAction.bind(null, id, bus.id)}>
                  <button className="text-red-600 hover:underline">Eliminar</button>
                </form>
              </li>
            );
          })}
        </ul>
        <CollapsibleAddForm>
          <form
            action={addBusAction.bind(null, id)}
            className="grid grid-cols-1 gap-3 sm:grid-cols-4"
          >
            <select name="starting_point_id" required className={inputClass}>
              <option value="">Punto de partida</option>
              {(startingPoints ?? []).map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </select>
            <input name="bus_number" type="number" min="1" placeholder="Número" required className={inputClass} />
            <input
              name="capacity"
              type="number"
              min="1"
              defaultValue={40}
              placeholder="Capacidad"
              required
              className={inputClass}
            />
            <button className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium">
              Agregar
            </button>
          </form>
        </CollapsibleAddForm>
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">Paradas</h2>
        <p className="text-sm text-neutral-600">
          Dirección y horario estimado se muestran a los inscriptos en el mapa de paradas
          público.
        </p>
        <ul className="divide-y divide-neutral-200">
          {(stops ?? []).map((stop) => (
            <StopListItem
              key={stop.id}
              stop={stop}
              inputClass={inputClass}
              updateAction={updateStopAction.bind(null, id, stop.id)}
              deleteAction={deleteStopAction.bind(null, id, stop.id)}
            />
          ))}
        </ul>
        <CollapsibleAddForm>
          <form
            action={addStopAction.bind(null, id)}
            className="grid grid-cols-1 gap-3 sm:grid-cols-5 sm:items-center"
          >
            <input
              name="sequence_order"
              type="number"
              min="0"
              placeholder="Orden"
              required
              className={inputClass}
            />
            <input name="name" placeholder="Nombre (ej. Merlo)" required className={inputClass} />
            <input name="location_description" placeholder="Dirección" className={inputClass} />
            <input name="expected_time" type="time" className={inputClass} />
            <input name="maps_url" placeholder="Link de Google Maps" className={inputClass} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_presentation_stop" />
              Es la parada de presentación
            </label>
            <button className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium">
              Agregar
            </button>
          </form>
        </CollapsibleAddForm>
      </section>
    </div>
  );
}
