import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { RegistrationRow, StartingPointRow, EventAuditLogRow, ProfileRow } from "@/lib/types";
import { updateRegistrationAction, setRegistrationStatusAction } from "./actions";
import { DeleteRegistrationButton } from "@/components/admin/DeleteRegistrationButton";
import { magicLinkPath } from "@/lib/magicLink";

const inputClass = "mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm";
const cardClass = "rounded-lg border border-neutral-200 bg-white p-4 space-y-4";
const checkboxRow = "flex items-center gap-2 text-sm";

const auditActionLabel: Record<string, string> = {
  registration_status_set_confirmed: "Marcada como pagada",
  registration_status_set_cancelled: "Inscripción cancelada",
  registration_status_set_pending_payment: "Vuelta a pendiente de pago",
  registration_no_show: "No se presentó en la Parroquia",
};

export default async function RegistrationDetailPage({
  params,
}: {
  params: Promise<{ id: string; registrationId: string }>;
}) {
  const { id, registrationId } = await params;
  const supabase = await createClient();

  const [{ data: registration }, { data: startingPoints }, { data: auditLog }] = await Promise.all([
    supabase
      .from("registrations")
      .select("*")
      .eq("id", registrationId)
      .single<RegistrationRow>(),
    supabase.from("starting_points").select("*").eq("event_id", id).returns<StartingPointRow[]>(),
    supabase
      .from("event_audit_log")
      .select("*")
      .eq("entity_table", "registrations")
      .eq("entity_id", registrationId)
      .order("created_at", { ascending: false })
      .returns<EventAuditLogRow[]>(),
  ]);

  if (!registration) notFound();

  const actorIds = [...new Set((auditLog ?? []).map((a) => a.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("*").in("id", actorIds).returns<ProfileRow[]>()
    : { data: [] as ProfileRow[] };
  const actorName = (actorId: string | null) =>
    actors?.find((a) => a.id === actorId)?.full_name ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {registration.last_name}, {registration.first_name}
          </h1>
          <p className="text-sm text-neutral-500">
            DNI {registration.dni} · Estado: {registration.status} · Inscripto el{" "}
            {new Date(registration.created_at).toLocaleString("es-AR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "America/Argentina/Buenos_Aires",
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={magicLinkPath(registrationId)}
            target="_blank"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            Ver su página (/mi-inscripcion)
          </a>
          {registration.status === "pending_payment" && (
            <form action={setRegistrationStatusAction.bind(null, id, registrationId, "confirmed")}>
              <button className="rounded-md bg-green-700 px-3 py-1.5 text-sm text-white">
                Marcar como pagada
              </button>
            </form>
          )}
          {registration.status !== "cancelled" && (
            <form action={setRegistrationStatusAction.bind(null, id, registrationId, "cancelled")}>
              <button className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700">
                Cancelar inscripción
              </button>
            </form>
          )}
          {registration.status === "cancelled" && (
            <DeleteRegistrationButton
              eventId={id}
              registrationId={registrationId}
              label="Eliminar definitivamente"
            />
          )}
        </div>
      </div>

      <section className={cardClass}>
        <h2 className="font-semibold">Documentos</h2>
        <div className="flex gap-4 text-sm">
          <a
            className="text-neutral-700 underline"
            href={`/api/documents/${registration.dni_photo_path}`}
            target="_blank"
          >
            Ver foto DNI
          </a>
          {registration.health_insurance_card_photo_path && (
            <a
              className="text-neutral-700 underline"
              href={`/api/documents/${registration.health_insurance_card_photo_path}`}
              target="_blank"
            >
              Ver carnet obra social
            </a>
          )}
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">Historial</h2>
        <ul className="space-y-1 text-sm">
          {(auditLog ?? []).map((entry) => (
            <li key={entry.id}>
              {auditActionLabel[entry.action] ?? entry.action} — {actorName(entry.actor_id)} —{" "}
              {new Date(entry.created_at).toLocaleString("es-AR", {
                timeZone: "America/Argentina/Buenos_Aires",
              })}
            </li>
          ))}
          {(auditLog ?? []).length === 0 && (
            <li className="text-neutral-500">Todavía no hay cambios registrados.</li>
          )}
        </ul>
      </section>

      <form
        action={updateRegistrationAction.bind(null, id, registrationId)}
        className={cardClass}
      >
        <h2 className="font-semibold">Datos</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Nombre</label>
            <input name="first_name" defaultValue={registration.first_name} className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium">Apellido</label>
            <input name="last_name" defaultValue={registration.last_name} className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium">DNI</label>
            <input name="dni" defaultValue={registration.dni} className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium">Celular</label>
            <input name="phone" defaultValue={registration.phone} className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <input name="email" defaultValue={registration.email} className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium">Punto de partida</label>
            <input
              disabled
              value={startingPoints?.find((sp) => sp.id === registration.starting_point_id)?.name ?? ""}
              className={`${inputClass} bg-neutral-100`}
            />
          </div>
        </div>

        <h3 className="pt-2 font-medium">Contacto de emergencia</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input
            name="emergency_contact_name"
            defaultValue={registration.emergency_contact_name}
            className={inputClass}
          />
          <input
            name="emergency_contact_phone"
            defaultValue={registration.emergency_contact_phone}
            className={inputClass}
          />
        </div>
        <label className={checkboxRow}>
          <input
            type="checkbox"
            name="returns_independently"
            defaultChecked={registration.returns_independently}
          />
          Vuelve por sus propios medios (no necesita micro de vuelta)
        </label>

        <h3 className="pt-2 font-medium">Obra social</h3>
        <label className={checkboxRow}>
          <input type="checkbox" name="has_health_insurance" defaultChecked={registration.has_health_insurance} />
          Tiene obra social
        </label>
        <input
          name="health_insurance_provider"
          defaultValue={registration.health_insurance_provider ?? ""}
          placeholder="¿Cuál? (ej. OSDE, Swiss Medical...)"
          className={inputClass}
        />
        <input
          name="health_insurance_member_number"
          defaultValue={registration.health_insurance_member_number ?? ""}
          placeholder="Número de afiliado"
          className={inputClass}
        />

        <h3 className="pt-2 font-medium">Información médica</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className={checkboxRow}>
            <input type="checkbox" name="has_allergies" defaultChecked={registration.has_allergies} />
            Alergias
          </label>
          <input
            name="allergies_detail"
            defaultValue={registration.allergies_detail ?? ""}
            placeholder="¿A qué?"
            className={inputClass}
          />
          <label className={checkboxRow}>
            <input type="checkbox" name="has_celiac" defaultChecked={registration.has_celiac} /> Celiaquía
          </label>
          <label className={checkboxRow}>
            <input type="checkbox" name="has_diabetes" defaultChecked={registration.has_diabetes} /> Diabetes
          </label>
          <label className={checkboxRow}>
            <input
              type="checkbox"
              name="has_hypertension"
              defaultChecked={registration.has_hypertension}
            />{" "}
            Hipertensión
          </label>
          <label className={checkboxRow}>
            <input
              type="checkbox"
              name="has_respiratory_condition"
              defaultChecked={registration.has_respiratory_condition}
            />{" "}
            Enfermedad respiratoria
          </label>
          <label className={checkboxRow}>
            <input
              type="checkbox"
              name="has_heart_condition"
              defaultChecked={registration.has_heart_condition}
            />{" "}
            Enfermedad cardíaca
          </label>
          <label className={checkboxRow}>
            <input
              type="checkbox"
              name="has_other_condition"
              defaultChecked={registration.has_other_condition}
            />{" "}
            Otra
          </label>
          <input
            name="other_condition_detail"
            defaultValue={registration.other_condition_detail ?? ""}
            placeholder="Especificar"
            className={inputClass}
          />
          <label className={checkboxRow}>
            <input
              type="checkbox"
              name="takes_medication"
              defaultChecked={registration.takes_medication}
            />{" "}
            Toma medicación
          </label>
          <input
            name="medication_detail"
            defaultValue={registration.medication_detail ?? ""}
            placeholder="¿Cuál?"
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          className="rounded-md bg-brand-ink px-4 py-2 text-sm font-semibold text-white"
        >
          Guardar cambios
        </button>
      </form>
    </div>
  );
}
