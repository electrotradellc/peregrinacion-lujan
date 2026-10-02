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

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export function ReturnBusesPanel({
  eventId,
  buses,
  countByBus,
}: {
  eventId: string;
  buses: ReturnBusRow[];
  countByBus: Record<string, number>;
}) {
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

  const nextNumber = buses.reduce((max, b) => Math.max(max, b.bus_number), 0) + 1;

  return (
    <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
      <div>
        <h2 className="text-base font-semibold">Micros de vuelta</h2>
        <p className="text-sm text-neutral-500">
          Lista propia, aparte de los micros de ida. Agregá cada micro cuando llega, con su número y asientos.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-800" role="alert">
          {error}
        </p>
      )}

      {buses.length > 0 && (
        <ul className="divide-y divide-neutral-100">
          {buses.map((b) => {
            const taken = countByBus[b.id] ?? 0;
            const full = taken >= b.capacity;
            const departed = b.departed_at !== null;
            return (
              <li key={b.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="w-20 font-medium">Micro {b.bus_number}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    full ? "bg-green-100 text-green-800" : "bg-neutral-100 text-neutral-700"
                  }`}
                >
                  {taken}/{b.capacity}
                </span>

                <form
                  className="flex items-center gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    run(() => updateReturnBusCapacityAction(eventId, b.id, formData));
                  }}
                >
                  <input
                    name="capacity"
                    type="number"
                    min="1"
                    defaultValue={b.capacity}
                    disabled={departed}
                    className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-sm disabled:bg-neutral-50"
                  />
                  <span className="text-xs text-neutral-500">asientos</span>
                  {!departed && (
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
                    >
                      Guardar
                    </button>
                  )}
                </form>

                <div className="ml-auto flex items-center gap-2">
                  {departed ? (
                    <button
                      type="button"
                      disabled={pending}
                      title="Tocar para reabrir el micro"
                      onClick={() => run(() => setReturnBusDepartedAction(eventId, b.id, false))}
                      className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 hover:bg-red-100 hover:text-red-800 disabled:opacity-50"
                    >
                      Salió — {formatTime(b.departed_at!)} ✕
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (
                          !full &&
                          !window.confirm(
                            `El micro ${b.bus_number} tiene ${taken} de ${b.capacity} asientos ocupados. ¿Marcar que salió igual?`,
                          )
                        ) {
                          return;
                        }
                        run(() => setReturnBusDepartedAction(eventId, b.id, true));
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
                        if (window.confirm(`¿Borrar el micro ${b.bus_number} de vuelta?`)) {
                          run(() => deleteReturnBusAction(eventId, b.id));
                        }
                      }}
                      className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Borrar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
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
            defaultValue={buses.at(-1)?.capacity ?? 40}
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
