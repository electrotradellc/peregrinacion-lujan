"use client";

import { useState, useTransition } from "react";
import { updateBusCapacityAction } from "@/app/(admin)/admin/eventos/[id]/config/actions";

// Guardar la capacidad de un micro no navega a ningún lado (es un campo
// suelto en medio de una lista larga) — sin feedback visual, el admin no
// tiene forma de saber si el click hizo algo hasta recargar la página.
export function BusCapacityForm({
  eventId,
  busId,
  initialCapacity,
}: {
  eventId: string;
  busId: string;
  initialCapacity: number;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        setSaved(false);
        startTransition(async () => {
          await updateBusCapacityAction(eventId, busId, formData);
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        });
      }}
    >
      <input
        name="capacity"
        type="number"
        min="1"
        defaultValue={initialCapacity}
        className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-sm"
      />
      <span className="text-xs text-neutral-500">lugares</span>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
      >
        {pending ? "Guardando..." : "Guardar"}
      </button>
      {saved && (
        <span className="text-xs font-medium text-green-700" role="status">
          ✓ Guardado
        </span>
      )}
    </form>
  );
}
