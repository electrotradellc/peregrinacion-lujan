"use client";

import { useState } from "react";
import type { StopRow } from "@/lib/types";

export function StopListItem({
  stop,
  inputClass,
  updateAction,
  deleteAction,
}: {
  stop: StopRow;
  inputClass: string;
  updateAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li className="py-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left text-sm"
      >
        <span>
          {stop.sequence_order}. <strong>{stop.name}</strong>
          {stop.is_presentation_stop && (
            <span className="ml-1 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600">
              presentación
            </span>
          )}
        </span>
        <span aria-hidden className="text-neutral-400">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <form action={updateAction} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-6 sm:items-center">
          <input
            name="sequence_order"
            type="number"
            min="0"
            defaultValue={stop.sequence_order}
            required
            className={inputClass}
          />
          <input name="name" defaultValue={stop.name} required className={inputClass} />
          <input
            name="location_description"
            defaultValue={stop.location_description ?? ""}
            placeholder="Dirección"
            className={inputClass}
          />
          <input
            name="expected_time"
            type="time"
            defaultValue={stop.expected_time?.slice(0, 5) ?? ""}
            className={inputClass}
          />
          <input
            name="maps_url"
            defaultValue={stop.maps_url ?? ""}
            placeholder="Link de Google Maps"
            className={inputClass}
          />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_presentation_stop" defaultChecked={stop.is_presentation_stop} />
              Presentación
            </label>
          </div>
          <div className="flex gap-3 sm:col-span-6">
            <button className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium">
              Guardar
            </button>
            <button type="submit" formAction={deleteAction} className="text-sm text-red-600 hover:underline">
              Eliminar
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
