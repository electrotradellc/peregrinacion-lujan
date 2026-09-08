"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  registrationFieldsSchema,
  validatePhotoFile,
  toTitleCase,
  formatPhoneDigits,
  type RegistrationFields,
} from "@/lib/validation/registrationSchema";
import type { ChangeEvent, ReactNode } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import type { EventRow, StartingPointRow } from "@/lib/types";

const cardClass = "bg-white rounded-3xl p-5 md:p-6 shadow-sm flex flex-col gap-5";
const inputClass =
  "h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-base text-neutral-900 placeholder:text-neutral-400 shadow-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition-colors";
const labelClass = "text-sm font-semibold text-neutral-800";
const errorClass = "text-sm text-danger";
const helperClass = "text-xs text-neutral-500";
const photoButtonClass =
  "flex-1 min-w-[130px] h-11 px-3 bg-white hover:bg-mist active:scale-95 text-brand-ink font-semibold text-sm rounded-full flex items-center justify-center gap-2 cursor-pointer shadow-sm border border-neutral-200 transition-all";
const conditionChipClass =
  "flex items-center gap-2 p-3 bg-neutral-50 rounded-xl cursor-pointer hover:bg-mist transition-colors text-sm";

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

// Cada sección repite el mismo encabezado (número + título + subtítulo +
// ícono) — se separa acá para no repetir el markup 4 veces.
function SectionHeader({
  step,
  title,
  subtitle,
  icon,
}: {
  step: number;
  title: string;
  subtitle: string;
  icon: string;
}) {
  return (
    <div className="flex items-center justify-between pb-1">
      <div className="flex items-center gap-3">
        <span className="w-8 h-8 rounded-full bg-mist text-terracotta font-bold flex items-center justify-center shrink-0">
          {step}
        </span>
        <div>
          <h2 className="font-semibold text-[17px] text-brand-ink leading-tight">{title}</h2>
          <p className="text-xs text-neutral-500">{subtitle}</p>
        </div>
      </div>
      <Icon name={icon} className="text-neutral-300 text-[22px]" />
    </div>
  );
}

function Field({
  label,
  helper,
  error,
  children,
}: {
  label: string;
  helper?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <label className={labelClass}>{label}</label>
      {children}
      {helper && !error && <p className={helperClass}>{helper}</p>}
      {error && <p className={errorClass}>{error}</p>}
    </div>
  );
}

// Formatea el valor a medida que se escribe (no recién al enviar), para que
// el usuario vea el resultado final en el campo. `format` no debe cambiar
// la posición del cursor de forma rara: se restaura a mano porque asignar
// `input.value` por código puede moverlo solo al final del texto.
function withLiveFormat(reg: UseFormRegisterReturn, format: (value: string) => string) {
  return (e: ChangeEvent<HTMLInputElement>) => {
    const pos = e.target.selectionStart;
    e.target.value = format(e.target.value);
    if (pos !== null) e.target.setSelectionRange(pos, pos);
    reg.onChange(e);
  };
}

// El celular se va acortando a medida que se saca el código de país (+54 /
// 549) — no tiene sentido mantener la posición original del cursor, va al
// final como en cualquier campo numérico que se autocompleta.
function withLivePhoneFormat(reg: UseFormRegisterReturn) {
  return (e: ChangeEvent<HTMLInputElement>) => {
    e.target.value = formatPhoneDigits(e.target.value);
    e.target.setSelectionRange(e.target.value.length, e.target.value.length);
    reg.onChange(e);
  };
}

// Las fotos de cámara de un celular actual suelen pesar varios MB — Vercel
// rechaza el pedido entero (sin llegar a nuestro código) si el body supera
// ~4.5MB, y eso el usuario lo ve como "no pudimos conectar con el servidor".
// Se reduce la imagen en el navegador antes de subirla, tanto para no
// chocar con ese límite como para que suba más rápido con datos móviles.
// Si el navegador no puede decodificar el formato (ej. HEIC en Chrome), se
// sube el archivo original tal cual — la validación de tamaño del servidor
// sigue siendo la última palabra.
async function compressImage(file: File, maxDimension = 1600, quality = 0.82): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

// Botones separados en vez de un solo <input type=file> — dejar que el
// picker nativo decida si ofrece cámara es poco confiable entre navegadores
// móviles: con `capture` algunos abren la cámara y esconden la galería, sin
// `capture` otros no ofrecen la cámara. Cada botón fuerza explícitamente un
// origen.
function PhotoField({
  label,
  helper,
  file,
  onChange,
  error,
}: {
  label: string;
  helper?: string;
  file: File | null;
  onChange: (file: File | null) => void;
  error?: string;
}) {
  const [compressing, setCompressing] = useState(false);

  const handlePick = async (picked: File | null) => {
    if (!picked) {
      onChange(null);
      return;
    }
    setCompressing(true);
    const compressed = await compressImage(picked);
    setCompressing(false);
    onChange(compressed);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className={labelClass}>{label}</label>
      <div className="bg-neutral-50 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-mist text-terracotta flex items-center justify-center">
          <Icon name="contact_page" className="text-[24px]" />
        </div>
        {helper && <p className="text-xs text-neutral-500 max-w-xs">{helper}</p>}
        <div className="flex flex-wrap items-center justify-center gap-2 w-full max-w-sm">
          <label className={photoButtonClass}>
            <Icon name="photo_camera" className="text-[18px]" />
            Sacar foto
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handlePick(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className={photoButtonClass}>
            <Icon name="collections" className="text-[18px]" />
            Elegir de la galería
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handlePick(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        {compressing && (
          <p className="text-xs text-neutral-500">Optimizando imagen...</p>
        )}
        {!compressing && file && (
          <div className="inline-flex items-center gap-2 bg-success-bg text-success px-3 py-1.5 rounded-full text-xs font-bold">
            <Icon name="check_circle" className="text-[16px]" />
            Seleccionado: {file.name} ({Math.round(file.size / 1024)} KB)
          </div>
        )}
      </div>
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

  // Se guardan aparte (no inline en el JSX) porque withLiveFormat necesita
  // el `onChange` original de react-hook-form para poder llamarlo después
  // de reescribir el valor.
  const firstNameReg = register("firstName");
  const lastNameReg = register("lastName");
  const phoneReg = register("phone");
  const emailReg = register("email");
  const emergencyContactPhoneReg = register("emergencyContactPhone");

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
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      {/* SECCIÓN 1: DATOS PERSONALES */}
      <div className={cardClass}>
        <SectionHeader
          step={1}
          title="Datos personales"
          subtitle="Información para tu credencial oficial de peregrino"
          icon="badge"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre" error={errors.firstName?.message}>
            <input
              className={inputClass}
              placeholder="Ej. Juan Martín"
              {...firstNameReg}
              onChange={withLiveFormat(firstNameReg, toTitleCase)}
            />
          </Field>
          <Field label="Apellido" error={errors.lastName?.message}>
            <input
              className={inputClass}
              placeholder="Ej. Pereyra"
              {...lastNameReg}
              onChange={withLiveFormat(lastNameReg, toTitleCase)}
            />
          </Field>
          <Field label="DNI" error={errors.dni?.message}>
            <input
              className={inputClass}
              inputMode="numeric"
              placeholder="Sin puntos (ej: 38452123)"
              {...register("dni")}
            />
          </Field>
          <Field label="Fecha de nacimiento" error={errors.birthDate?.message}>
            <input className={inputClass} type="date" {...register("birthDate")} />
          </Field>
          <Field
            label="Celular (WhatsApp)"
            helper="Solo característica y número, sin el 54 (ej: 1123456789)."
            error={errors.phone?.message}
          >
            <input
              className={inputClass}
              inputMode="tel"
              placeholder="11 5489 1234"
              {...phoneReg}
              onChange={withLivePhoneFormat(phoneReg)}
            />
          </Field>
          <Field
            label="Correo electrónico"
            helper="Te enviaremos tu credencial y link de acceso aquí."
            error={errors.email?.message}
          >
            <input
              className={inputClass}
              type="email"
              placeholder="tunombre@correo.com"
              {...emailReg}
              onChange={withLiveFormat(emailReg, (v) => v.toLowerCase())}
            />
          </Field>
        </div>
        <PhotoField
          label="Foto del DNI (frente)"
          helper="Subí una foto nítida de tu documento — requerido por los seguros de ruta y transporte."
          file={dniPhoto}
          onChange={setDniPhoto}
          error={fileErrors.dni}
        />
      </div>

      {/* SECCIÓN 2: PUNTO DE PARTIDA Y REGRESO */}
      <div className={cardClass}>
        <SectionHeader
          step={2}
          title="Punto de partida y regreso"
          subtitle="¿Desde dónde salís caminando y cómo volvés?"
          icon="route"
        />
        <div className="flex flex-col gap-2">
          <label className={labelClass}>Elegí tu punto de salida</label>
          {startingPoints.map((sp) => (
            <label
              key={sp.id}
              className="relative flex items-center gap-3 p-4 bg-neutral-50 hover:bg-mist rounded-xl cursor-pointer transition-colors"
            >
              <input
                type="radio"
                value={sp.id}
                className="w-5 h-5 accent-terracotta cursor-pointer"
                {...register("startingPointId")}
              />
              <div className="flex-1 flex items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-sm text-neutral-900 block">{sp.name}</span>
                  <span className="text-xs text-neutral-500">
                    Presentarse {sp.presentation_time.slice(0, 5)}hs en {sp.presentation_location}
                  </span>
                </div>
                <Icon name="hiking" className="text-terracotta text-[22px] shrink-0" />
              </div>
            </label>
          ))}
          {errors.startingPointId && <p className={errorClass}>{errors.startingPointId.message}</p>}
        </div>
        <label className="p-4 rounded-xl bg-mist/60 flex items-start gap-3 cursor-pointer">
          <input type="checkbox" className="mt-1 w-5 h-5 accent-terracotta" {...register("returnsIndependently")} />
          <span>
            <span className="font-semibold text-sm text-neutral-900 block">
              Vuelvo por mis propios medios
            </span>
            <span className="text-xs text-neutral-500">
              Marcá esta casilla si no vas a utilizar los micros de regreso de la parroquia desde
              Luján a San Isidro.
            </span>
          </span>
        </label>
      </div>

      {/* SECCIÓN 3: INFORMACIÓN MÉDICA & CUIDADO COMUNITARIO */}
      <div className={cardClass}>
        <SectionHeader
          step={3}
          title="Cuidado y equipo médico"
          subtitle="Para cuidarte y asistirte de forma inmediata si lo necesitás"
          icon="health_and_safety"
        />
        <div className="bg-info-bg text-info p-3 rounded-xl flex items-start gap-2">
          <Icon name="lock" className="text-[20px] shrink-0 mt-0.5" />
          <p className="text-xs text-neutral-600 leading-relaxed">
            <strong className="text-neutral-900">Privacidad asegurada:</strong> Esta información
            es estrictamente confidencial. Solo la visualiza el equipo de coordinación médica y
            el referente de tu micro.
          </p>
        </div>

        <div className="flex flex-col gap-3 bg-neutral-50 p-4 rounded-xl">
          <label className="flex items-center gap-3 cursor-pointer select-none text-sm">
            <input
              type="checkbox"
              className="w-5 h-5 accent-terracotta"
              {...register("hasHealthInsurance", {
                onChange: (e) => setHasHealthInsurance(e.target.checked),
              })}
            />
            <span className="font-semibold text-neutral-900">Cuento con Obra Social / Prepaga</span>
          </label>
          {hasHealthInsurance && (
            <div className="flex flex-col gap-3 pt-1">
              <Field label="¿Cuál?" error={errors.healthInsuranceProvider?.message}>
                <input
                  className={inputClass}
                  placeholder="Ej: OSDE, Swiss Medical, PAMI, etc."
                  {...register("healthInsuranceProvider")}
                />
              </Field>
              <Field label="Número de afiliado" error={errors.healthInsuranceMemberNumber?.message}>
                <input className={inputClass} {...register("healthInsuranceMemberNumber")} />
              </Field>
              <PhotoField
                label="Foto del carnet"
                file={insuranceCardPhoto}
                onChange={setInsuranceCardPhoto}
                error={fileErrors.insurance}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className={labelClass}>Condiciones médicas o antecedentes (marcar las que correspondan):</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <label className={conditionChipClass}>
              <input type="checkbox" className="w-4 h-4 accent-terracotta" {...register("hasAllergies", { onChange: (e) => setHasAllergies(e.target.checked) })} />
              Alergias
            </label>
            <label className={conditionChipClass}>
              <input type="checkbox" className="w-4 h-4 accent-terracotta" {...register("hasCeliac")} />
              Celiaquía
            </label>
            <label className={conditionChipClass}>
              <input type="checkbox" className="w-4 h-4 accent-terracotta" {...register("hasDiabetes")} />
              Diabetes
            </label>
            <label className={conditionChipClass}>
              <input type="checkbox" className="w-4 h-4 accent-terracotta" {...register("hasHypertension")} />
              Hipertensión
            </label>
            <label className={conditionChipClass}>
              <input type="checkbox" className="w-4 h-4 accent-terracotta" {...register("hasRespiratoryCondition")} />
              Enf. respiratoria
            </label>
            <label className={conditionChipClass}>
              <input type="checkbox" className="w-4 h-4 accent-terracotta" {...register("hasHeartCondition")} />
              Enf. cardíaca
            </label>
            <label className={conditionChipClass}>
              <input
                type="checkbox"
                className="w-4 h-4 accent-terracotta"
                {...register("takesMedication", { onChange: (e) => setTakesMedication(e.target.checked) })}
              />
              Toma medicación
            </label>
            <label className={conditionChipClass}>
              <input
                type="checkbox"
                className="w-4 h-4 accent-terracotta"
                {...register("hasOtherCondition", { onChange: (e) => setHasOtherCondition(e.target.checked) })}
              />
              Otra condición
            </label>
          </div>
          {hasAllergies && (
            <Field label="¿A qué sos alérgico/a?" error={errors.allergiesDetail?.message}>
              <input className={inputClass} {...register("allergiesDetail")} />
            </Field>
          )}
          {takesMedication && (
            <Field label="¿Qué medicación tomás?" error={errors.medicationDetail?.message}>
              <input className={inputClass} {...register("medicationDetail")} />
            </Field>
          )}
          {hasOtherCondition && (
            <Field label="Especificar condición" error={errors.otherConditionDetail?.message}>
              <input className={inputClass} {...register("otherConditionDetail")} />
            </Field>
          )}
        </div>

        <div className="pt-2 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Icon name="emergency" className="text-terracotta text-[18px]" />
            <h3 className="font-semibold text-sm text-brand-ink">Contacto en caso de emergencia</h3>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nombre y apellido" error={errors.emergencyContactName?.message}>
              <input className={inputClass} placeholder="Familiar o amigo" {...register("emergencyContactName")} />
            </Field>
            <Field label="Celular de contacto" error={errors.emergencyContactPhone?.message}>
              <input
                className={inputClass}
                inputMode="tel"
                placeholder="11 0000 0000"
                {...emergencyContactPhoneReg}
                onChange={withLivePhoneFormat(emergencyContactPhoneReg)}
              />
            </Field>
          </div>
        </div>
      </div>

      {/* SECCIÓN 4: TÉRMINOS Y CONDICIONES */}
      <div className={cardClass}>
        <SectionHeader
          step={4}
          title="Términos y condiciones"
          subtitle="Pautas de convivencia y confirmación de plaza"
          icon="gavel"
        />
        <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl bg-neutral-50 p-4 text-sm text-neutral-600 leading-relaxed">
          {event.terms_and_conditions}
        </div>
        <label className="p-3 rounded-xl bg-neutral-50 flex items-start gap-3 cursor-pointer">
          <input type="checkbox" className="mt-1 w-5 h-5 accent-terracotta" {...register("termsAccepted")} />
          <span className="text-sm text-neutral-800">
            He leído y acepto los Términos y Condiciones de la peregrinación.
          </span>
        </label>
        {errors.termsAccepted && <p className={errorClass}>{errors.termsAccepted.message}</p>}
      </div>

      {submitError && (
        <p className="rounded-xl bg-danger-bg p-3 text-sm text-danger">{submitError}</p>
      )}

      {/* BOTÓN PRINCIPAL DE ENVÍO */}
      <div className="flex flex-col items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="w-full h-14 bg-terracotta hover:bg-terracotta-hover text-white rounded-full font-bold text-base shadow-md flex items-center justify-center gap-3 active:scale-[0.985] transition-all disabled:opacity-50"
        >
          {submitting
            ? "Procesando..."
            : `Enviar inscripción — $${event.registration_price_ars.toLocaleString("es-AR")}`}
          {!submitting && <Icon name="arrow_forward" className="text-[20px]" />}
        </button>
        <div className="flex items-center gap-2 text-neutral-500">
          <Icon name="verified" className="text-[16px] text-success" />
          <span className="text-xs">Inscripción protegida • Parroquia San Isidro Labrador</span>
        </div>
      </div>
    </form>
  );
}
