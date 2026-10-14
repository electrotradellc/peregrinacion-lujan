"use client";

import { useState, useTransition } from "react";
import {
  addReturnBusAction,
  deleteReturnBusAction,
  setReturnBusDepartedAction,
  updateReturnBusCapacityAction,
  type ReturnActionResult,
} from "@/lib/actions/returnBuses";
import type { ReturnBusRow } from "@/lib/types";

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

// Ejecuta una acción del servidor mostrando el motivo si falla (sin la página
// de error genérica de Next).
function useReturnAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run(fn: () => Promise<ReturnActionResult>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
      else onOk?.();
    });
  }
  return { pending, error, run };
}

// Asientos, "Salió" y "Borrar" de un micro de vuelta. Se usa tanto en la
// solapa de asignación (micros abiertos) como en la de micros (todos).
export function ReturnBusControls({
  eventId,
  bus,
  taken,
}: {
  eventId: string;
  bus: ReturnBusRow;
  taken: number;
}) {
  const { pending, error, run } = useReturnAction();
  const full = taken >= bus.capacity;
  const departed = bus.departed_at !== null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          run(() => updateReturnBusCapacityAction(eventId, bus.id, formData));
        }}
      >
        <input
          name="capacity"
          type="number"
          min="1"
          defaultValue={bus.capacity}
          className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-sm"
        />
        <span className="text-xs text-neutral-500">asientos</span>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
        >
          Guardar
        </button>
      </form>

      {departed ? (
        <button
          type="button"
          disabled={pending}
          title="Tocar para reabrir el micro"
          onClick={() => run(() => setReturnBusDepartedAction(eventId, bus.id, false))}
          className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 hover:bg-red-100 hover:text-red-800 disabled:opacity-50"
        >
          Salió — {formatTime(bus.departed_at!)} ✕
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (
              !full &&
              !window.confirm(
                `El micro ${bus.bus_number} tiene ${taken} de ${bus.capacity} asientos ocupados. ¿Marcar que salió igual?`,
              )
            ) {
              return;
            }
            run(() => setReturnBusDepartedAction(eventId, bus.id, true));
          }}
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
        >
          Salió
        </button>
      )}

      {taken === 0 && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm(`¿Borrar el micro ${bus.bus_number} de vuelta?`)) {
              run(() => deleteReturnBusAction(eventId, bus.id));
            }
          }}
          className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Borrar
        </button>
      )}

      {error && (
        <p className="w-full text-xs font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// Solapa "Asignar": solo los micros abiertos (los que ya salieron están en la
// solapa Micros) + alta de un micro nuevo.
export function ReturnBusesPanel({
  eventId,
  openBuses,
  allBuses,
  countByBus,
}: {
  eventId: string;
  openBuses: ReturnBusRow[];
  allBuses: ReturnBusRow[];
  countByBus: Record<string, number>;
}) {
  const { pending, error, run } = useReturnAction();
  const nextNumber = allBuses.reduce((max, b) => Math.max(max, b.bus_number), 0) + 1;

  return (
    <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
      <div>
        <h2 className="text-base font-semibold">Micros de vuelta abiertos</h2>
        <p className="text-sm text-neutral-500">
          Lista propia, aparte de los micros de ida. Agregá cada micro cuando llega, con su número y asientos.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-800" role="alert">
          {error}
        </p>
      )}

      {openBuses.length > 0 ? (
        <ul className="divide-y divide-neutral-100">
          {openBuses.map((b) => {
            const taken = countByBus[b.id] ?? 0;
            return (
              <li key={b.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="w-20 font-medium">Micro {b.bus_number}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    taken >= b.capacity ? "bg-green-100 text-green-800" : "bg-neutral-100 text-neutral-700"
                  }`}
                >
                  {taken}/{b.capacity}
                </span>
                <ReturnBusControls eventId={eventId} bus={b} taken={taken} />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-neutral-500">No hay micros abiertos. Agregá uno para empezar a asignar.</p>
      )}

      <form
        key={nextNumber}
        className="flex flex-wrap items-end gap-2 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          run(() => addReturnBusAction(eventId, formData));
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Micro nº</span>
          <input
            name="bus_number"
            type="number"
            min="1"
            defaultValue={nextNumber}
            required
            className="w-20 rounded-md border border-neutral-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Asientos</span>
          <input
            name="capacity"
            type="number"
            min="1"
            defaultValue={allBuses.at(-1)?.capacity ?? 40}
            required
            className="w-20 rounded-md border border-neutral-300 px-2 py-1"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          Agregar micro de vuelta
        </button>
      </form>
    </section>
  );
}
