"use client";

import { useState, useTransition } from "react";
import { deleteRegistrationAction } from "@/app/(admin)/admin/eventos/[id]/inscripciones/[registrationId]/actions";

export function DeleteRegistrationButton({
  eventId,
  registrationId,
  label = "Eliminar",
}: {
  eventId: string;
  registrationId: string;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="inline-block">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              "¿Eliminar esta inscripción definitivamente? No se puede deshacer (se borran también las fotos cargadas).",
            )
          ) {
            return;
          }
          setError(null);
          startTransition(async () => {
            try {
              await deleteRegistrationAction(eventId, registrationId);
            } catch (err) {
              setError(err instanceof Error ? err.message : "No se pudo eliminar");
            }
          });
        }}
        className="text-red-600 hover:underline disabled:opacity-50"
      >
        {pending ? "Eliminando..." : label}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
