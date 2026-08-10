import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { RegistrationRow, StartingPointRow, PaymentRow } from "@/lib/types";
import { updateRegistrationAction, setRegistrationStatusAction } from "./actions";
import { VerifyPaymentButton } from "@/components/admin/VerifyPaymentButton";

const inputClass = "mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm";
const cardClass = "rounded-lg border border-neutral-200 bg-white p-4 space-y-4";
const checkboxRow = "flex items-center gap-2 text-sm";

export default async function RegistrationDetailPage({
  params,
}: {
  params: Promise<{ id: string; registrationId: string }>;
}) {
  const { id, registrationId } = await params;
  const supabase = await createClient();

  const [{ data: registration }, { data: startingPoints }, { data: payments }] = await Promise.all([
    supabase
      .from("registrations")
      .select("*")
      .eq("id", registrationId)
      .single<RegistrationRow>(),
    supabase.from("starting_points").select("*").eq("event_id", id).returns<StartingPointRow[]>(),
    supabase
      .from("payments")
      .select("*")
      .eq("registration_id", registrationId)
      .order("created_at", { ascending: false })
      .returns<PaymentRow[]>(),
  ]);

  if (!registration) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {registration.last_name}, {registration.first_name}
          </h1>
          <p className="text-sm text-neutral-500">DNI {registration.dni} · Estado: {registration.status}</p>
        </div>
        <div className="flex gap-2">
          {registration.status === "pending_payment" && (
            <form action={setRegistrationStatusAction.bind(null, id, registrationId, "confirmed")}>
              <button className="rounded-md bg-green-700 px-3 py-1.5 text-sm text-white">
                Confirmar manualmente
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
        <h2 className="font-semibold">Pagos</h2>
        <ul className="space-y-1 text-sm">
          {(payments ?? []).map((p) => (
            <li key={p.id}>
              {p.status} — ${p.amount ?? "-"} — {new Date(p.created_at).toLocaleString("es-AR")}
              {p.mp_payment_id && <span className="text-neutral-500"> (MP #{p.mp_payment_id})</span>}
            </li>
          ))}
          {(payments ?? []).length === 0 && <li className="text-neutral-500">Sin pagos registrados.</li>}
        </ul>
        {registration.status === "pending_payment" && (
          <VerifyPaymentButton registrationId={registrationId} />
        )}
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

        <h3 className="pt-2 font-medium">Obra social</h3>
        <label className={checkboxRow}>
          <input type="checkbox" name="has_health_insurance" defaultChecked={registration.has_health_insurance} />
          Tiene obra social
        </label>
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
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Guardar cambios
        </button>
      </form>
    </div>
  );
}
