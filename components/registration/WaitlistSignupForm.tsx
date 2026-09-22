"use client";

import { useState, type ChangeEvent, type KeyboardEvent } from "react";

const inputClass =
  "h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition-colors";

type Fields = { firstName: string; lastName: string; dni: string; phone: string; email: string };

// Mini-formulario inline (no un componente de página aparte) porque solo
// tiene sentido en el contexto exacto de "este punto de partida está
// lleno" dentro del formulario de inscripción — no hay una ruta propia.
export function WaitlistSignupForm({
  eventId,
  startingPointId,
  startingPointName,
  defaultOpen = false,
}: {
  eventId: string;
  startingPointId: string;
  startingPointName: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Fields>({
    firstName: "",
    lastName: "",
    dni: "",
    phone: "",
    email: "",
  });

  const update = (key: keyof Fields) => (e: ChangeEvent<HTMLInputElement>) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));

  // Esto vive DENTRO del <form> principal de inscripción (misma sección de
  // "punto de partida"), así que no puede ser un <form> propio — HTML no
  // permite forms anidados y React 19 lo detecta en hidratación. Por eso es
  // un botón normal con validación manual en vez de onSubmit + required.
  const onSubmit = async () => {
    if (!fields.firstName || !fields.lastName || !fields.dni || !fields.phone || !fields.email) {
      setError("Completá todos los campos para anotarte.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, startingPointId, ...fields }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "No pudimos anotarte en la lista de espera. Intentá de nuevo.");
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError("No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.");
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="mt-2 flex items-start gap-2 rounded-xl bg-success-bg p-3 text-xs text-success">
        <span className="material-symbols-outlined text-[16px] shrink-0">check_circle</span>
        <span>
          ¡Listo! Te anotamos en la lista de espera de {startingPointName}. Te avisamos por email
          si se libera un lugar.
        </span>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-xs font-semibold text-terracotta underline underline-offset-2"
      >
        Anotarme en la lista de espera
      </button>
    );
  }

  // Al no ser un <form>, Enter dentro de un input no dispara onSubmit acá —
  // en cambio burbujea hasta el <form> de inscripción y lo envía a él. Se
  // intercepta a mano para que Enter haga lo que la persona espera.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div onKeyDown={onKeyDown} className="mt-2 flex flex-col gap-2 rounded-xl bg-white p-3 shadow-sm">
      <p className="text-xs text-neutral-500">
        Dejanos tus datos y te avisamos por email si se libera un lugar en {startingPointName}.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          placeholder="Nombre"
          value={fields.firstName}
          onChange={update("firstName")}
          className={inputClass}
        />
        <input
          placeholder="Apellido"
          value={fields.lastName}
          onChange={update("lastName")}
          className={inputClass}
        />
        <input
          placeholder="DNI"
          inputMode="numeric"
          value={fields.dni}
          onChange={update("dni")}
          className={inputClass}
        />
        <input
          placeholder="Celular (11 5489 1234)"
          inputMode="tel"
          value={fields.phone}
          onChange={update("phone")}
          className={inputClass}
        />
        <input
          type="email"
          placeholder="Email"
          value={fields.email}
          onChange={update("email")}
          className={`${inputClass} sm:col-span-2`}
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="rounded-full bg-terracotta px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          {submitting ? "Enviando..." : "Anotarme"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-neutral-500 hover:underline">
          Cancelar
        </button>
      </div>
    </div>
  );
}
