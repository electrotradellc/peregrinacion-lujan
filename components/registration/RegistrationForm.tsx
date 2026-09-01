"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  registrationFieldsSchema,
  validatePhotoFile,
  type RegistrationFields,
} from "@/lib/validation/registrationSchema";
import type { EventRow, StartingPointRow } from "@/lib/types";

const inputClass =
  "mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";
const labelClass = "block text-sm font-medium text-neutral-800";
const errorClass = "mt-1 text-sm text-red-600";
const sectionClass = "rounded-lg border border-neutral-200 p-4 space-y-4";
const photoButtonClass =
  "cursor-pointer rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50";

// Botones separados en vez de un solo <input type=file> — dejar que el
// picker nativo decida si ofrece cámara es poco confiable entre navegadores
// móviles: con `capture` algunos abren la cámara y esconden la galería, sin
// `capture` otros no ofrecen la cámara. Cada botón fuerza explícitamente un
// origen.
function PhotoField({
  label,
  file,
  onChange,
  error,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  error?: string;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="mt-1 flex flex-wrap gap-2">
        <label className={photoButtonClass}>
          Sacar foto
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className={photoButtonClass}>
          Elegir de la galería
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      {file && <p className="mt-1 text-xs text-neutral-500">Seleccionado: {file.name}</p>}
      {error && <p className={errorClass}>{error}</p>}
    </div>
  );
}

export function RegistrationForm({
  event,
  startingPoints,
}: {
  event: EventRow;
  startingPoints: StartingPointRow[];
}) {
  const [dniPhoto, setDniPhoto] = useState<File | null>(null);
  const [insuranceCardPhoto, setInsuranceCardPhoto] = useState<File | null>(null);
  const [fileErrors, setFileErrors] = useState<{ dni?: string; insurance?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Estado propio (no `watch()`) para decidir si se muestran los campos
  // condicionales — más robusto entre navegadores que depender de la
  // resuscripción de react-hook-form solo para mostrar/ocultar UI.
  const [hasHealthInsurance, setHasHealthInsurance] = useState(false);
  const [hasAllergies, setHasAllergies] = useState(false);
  const [hasOtherCondition, setHasOtherCondition] = useState(false);
  const [takesMedication, setTakesMedication] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegistrationFields>({
    resolver: zodResolver(registrationFieldsSchema),
    defaultValues: {
      eventId: event.id,
      hasHealthInsurance: false,
      hasAllergies: false,
      hasCeliac: false,
      hasDiabetes: false,
      hasHypertension: false,
      hasRespiratoryCondition: false,
      hasHeartCondition: false,
      hasOtherCondition: false,
      takesMedication: false,
      returnsIndependently: false,
      termsVersion: event.terms_version,
      termsAccepted: false,
    },
  });

  const onSubmit = async (data: RegistrationFields) => {
    setSubmitError(null);

    const dniError = validatePhotoFile(dniPhoto, true);
    const insuranceError = validatePhotoFile(
      insuranceCardPhoto,
      data.hasHealthInsurance,
    );
    if (dniError || insuranceError) {
      setFileErrors({ dni: dniError ?? undefined, insurance: insuranceError ?? undefined });
      return;
    }
    setFileErrors({});

    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      formData.append(key, typeof value === "boolean" ? String(value) : (value ?? ""));
    });
    if (dniPhoto) formData.append("dniPhoto", dniPhoto);
    if (insuranceCardPhoto) formData.append("healthInsuranceCardPhoto", insuranceCardPhoto);

    setSubmitting(true);
    try {
      const res = await fetch("/api/registrations", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error ?? "No pudimos procesar la inscripción. Intentá de nuevo.");
        setSubmitting(false);
        return;
      }
      window.location.assign(json.redirectTo);
    } catch {
      setSubmitError("No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <section className={sectionClass}>
        <h2 className="text-lg font-semibold">Datos personales</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Nombre</label>
            <input className={inputClass} {...register("firstName")} />
            {errors.firstName && <p className={errorClass}>{errors.firstName.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Apellido</label>
            <input className={inputClass} {...register("lastName")} />
            {errors.lastName && <p className={errorClass}>{errors.lastName.message}</p>}
          </div>
          <div>
            <label className={labelClass}>DNI</label>
            <input className={inputClass} inputMode="numeric" {...register("dni")} />
            {errors.dni && <p className={errorClass}>{errors.dni.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Celular</label>
            <input className={inputClass} inputMode="tel" {...register("phone")} />
            {errors.phone && <p className={errorClass}>{errors.phone.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input className={inputClass} type="email" {...register("email")} />
            {errors.email && <p className={errorClass}>{errors.email.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Fecha de nacimiento</label>
            <input className={inputClass} type="date" {...register("birthDate")} />
            {errors.birthDate && <p className={errorClass}>{errors.birthDate.message}</p>}
          </div>
        </div>
        <PhotoField
          label="Foto del DNI (frente)"
          file={dniPhoto}
          onChange={setDniPhoto}
          error={fileErrors.dni}
        />
      </section>

      <section className={sectionClass}>
        <h2 className="text-lg font-semibold">Salida</h2>
        <div>
          <label className={labelClass}>¿Desde dónde salís caminando?</label>
          <select className={inputClass} {...register("startingPointId")}>
            <option value="">Elegí una opción</option>
            {startingPoints.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name} — presentarse {sp.presentation_time.slice(0, 5)}hs en{" "}
                {sp.presentation_location}
              </option>
            ))}
          </select>
          {errors.startingPointId && (
            <p className={errorClass}>{errors.startingPointId.message}</p>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register("returnsIndependently")} />
          Vuelvo por mis propios medios (no necesito micro de vuelta)
        </label>
      </section>

      <section className={sectionClass}>
        <h2 className="text-lg font-semibold">Información para el equipo médico</h2>
        <p className="text-sm text-neutral-600">
          Marcá lo que corresponda. Esta información solo la ve el equipo organizador y el
          referente de tu micro, para poder asistirte mejor ante una emergencia.
        </p>

        <div className="space-y-4 border-b border-neutral-200 pb-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              {...register("hasHealthInsurance", {
                onChange: (e) => setHasHealthInsurance(e.target.checked),
              })}
            />
            Tengo obra social
          </label>
          {hasHealthInsurance && (
            <div className="space-y-4">
              <div>
                <label className={labelClass}>¿Cuál?</label>
                <input className={inputClass} {...register("healthInsuranceProvider")} />
                {errors.healthInsuranceProvider && (
                  <p className={errorClass}>{errors.healthInsuranceProvider.message}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>Número de afiliado</label>
                <input className={inputClass} {...register("healthInsuranceMemberNumber")} />
                {errors.healthInsuranceMemberNumber && (
                  <p className={errorClass}>{errors.healthInsuranceMemberNumber.message}</p>
                )}
              </div>
              <PhotoField
                label="Foto del carnet"
                file={insuranceCardPhoto}
                onChange={setInsuranceCardPhoto}
                error={fileErrors.insurance}
              />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              {...register("hasAllergies", { onChange: (e) => setHasAllergies(e.target.checked) })}
            />
            Alergias
          </label>
          {hasAllergies && (
            <div>
              <label className={labelClass}>¿A qué?</label>
              <input className={inputClass} {...register("allergiesDetail")} />
              {errors.allergiesDetail && (
                <p className={errorClass}>{errors.allergiesDetail.message}</p>
              )}
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("hasCeliac")} /> Celiaquía
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("hasDiabetes")} /> Diabetes
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("hasHypertension")} /> Hipertensión
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("hasRespiratoryCondition")} /> Enfermedad
            respiratoria
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("hasHeartCondition")} /> Enfermedad cardíaca
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              {...register("hasOtherCondition", {
                onChange: (e) => setHasOtherCondition(e.target.checked),
              })}
            />{" "}
            Otra
          </label>
          {hasOtherCondition && (
            <div>
              <label className={labelClass}>Especificar</label>
              <input className={inputClass} {...register("otherConditionDetail")} />
              {errors.otherConditionDetail && (
                <p className={errorClass}>{errors.otherConditionDetail.message}</p>
              )}
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              {...register("takesMedication", { onChange: (e) => setTakesMedication(e.target.checked) })}
            />{" "}
            Toma medicación
          </label>
          {takesMedication && (
            <div>
              <label className={labelClass}>¿Cuál?</label>
              <input className={inputClass} {...register("medicationDetail")} />
              {errors.medicationDetail && (
                <p className={errorClass}>{errors.medicationDetail.message}</p>
              )}
            </div>
          )}
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className="text-lg font-semibold">Contacto de emergencia</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Nombre y apellido</label>
            <input className={inputClass} {...register("emergencyContactName")} />
            {errors.emergencyContactName && (
              <p className={errorClass}>{errors.emergencyContactName.message}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>Celular</label>
            <input className={inputClass} inputMode="tel" {...register("emergencyContactPhone")} />
            {errors.emergencyContactPhone && (
              <p className={errorClass}>{errors.emergencyContactPhone.message}</p>
            )}
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className="text-lg font-semibold">Términos y condiciones</h2>
        <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
          {event.terms_and_conditions}
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" {...register("termsAccepted")} />
          Acepto los Términos y Condiciones de la peregrinación.
        </label>
        {errors.termsAccepted && <p className={errorClass}>{errors.termsAccepted.message}</p>}
      </section>

      {submitError && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{submitError}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-brand-ink px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {submitting
          ? "Procesando..."
          : `Enviar inscripción — $${event.registration_price_ars.toLocaleString("es-AR")}`}
      </button>
    </form>
  );
}
