"use client";

import { useMemo, useState, useTransition } from "react";
import { assignManyToReturnBusAction } from "@/lib/actions/returnBuses";
import type { ReturnBusRow } from "@/lib/types";
import { ReturnBusesPanel } from "@/components/admin/ReturnBusesPanel";
import { comparePilgrimCode, matchesPerson, type ReturnPerson } from "@/components/admin/returnTypes";

type Sort = "code" | "name";

// Solapa "Asignar": micros abiertos + lista de peregrinos pendientes con
// tildes. El contador de la cabecera suma los que ya están en el micro y los
// tildados contra sus asientos, y se asigna todo junto (con opción de cerrar
// el micro en el mismo paso).
export function ReturnAssign({
  eventId,
  pending,
  buses,
  countByBus,
  targetBusId,
  onTargetBusChange,
  selected,
  onSelectedChange,
  assignedCount,
  independentCount,
  withdrawnCount,
}: {
  eventId: string;
  pending: ReturnPerson[];
  buses: ReturnBusRow[];
  countByBus: Record<string, number>;
  targetBusId: string;
  onTargetBusChange: (busId: string) => void;
  selected: Set<string>;
  onSelectedChange: (selected: Set<string>) => void;
  assignedCount: number;
  independentCount: number;
  withdrawnCount: number;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("code");
  const [saving, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const openBuses = useMemo(() => buses.filter((b) => b.departed_at === null), [buses]);
  const closedBuses = useMemo(() => buses.filter((b) => b.departed_at !== null), [buses]);

  // Si el micro elegido ya no existe (o todavía no se eligió), el primero abierto.
  const targetBus = buses.find((b) => b.id === targetBusId) ?? openBuses[0] ?? null;
  const already = targetBus ? (countByBus[targetBus.id] ?? 0) : 0;
  const ticked = pending.filter((p) => selected.has(p.registrationId));
  const total = already + ticked.length;
  const capacity = targetBus?.capacity ?? 0;
  const over = targetBus !== null && total > capacity;

  const filtered = useMemo(() => {
    let rows = pending;
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      rows = rows.filter((p) => matchesPerson(p, needle));
    }
    return [...rows].sort((a, b) =>
      sort === "name"
        ? a.lastName.localeCompare(b.lastName, "es") || a.firstName.localeCompare(b.firstName, "es")
        : comparePilgrimCode(a, b),
    );
  }, [pending, q, sort]);

  function toggle(registrationId: string) {
    const next = new Set(selected);
    if (next.has(registrationId)) next.delete(registrationId);
    else next.add(registrationId);
    onSelectedChange(next);
  }

  function submit(close: boolean) {
    if (!targetBus || ticked.length === 0) return;
    if (
      close &&
      total < targetBus.capacity &&
      !window.confirm(
        `El micro ${targetBus.bus_number} va a quedar con ${total} de ${targetBus.capacity} asientos ocupados. ¿Cerrarlo igual?`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await assignManyToReturnBusAction(
        eventId,
        targetBus.id,
        ticked.map((p) => p.registrationId),
        close,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      onSelectedChange(new Set());
      if (close) onTargetBusChange("");
    });
  }

  return (
    <div className="space-y-4">
      <ReturnBusesPanel eventId={eventId} openBuses={openBuses} allBuses={buses} countByBus={countByBus} />

      <div className="sticky top-0 z-10 space-y-2 rounded-lg border border-neutral-300 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium text-neutral-600">Asignar al micro</span>
            <select
              value={targetBus?.id ?? ""}
              onChange={(e) => onTargetBusChange(e.target.value)}
              className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            >
              {!targetBus && <option value="">Elegí un micro</option>}
              {openBuses.map((b) => (
                <option key={b.id} value={b.id}>
                  Micro {b.bus_number} ({countByBus[b.id] ?? 0}/{b.capacity})
                </option>
              ))}
              {closedBuses.length > 0 && (
                <optgroup label="Ya salieron (corregir)">
                  {closedBuses.map((b) => (
                    <option key={b.id} value={b.id}>
                      Micro {b.bus_number} ({countByBus[b.id] ?? 0}/{b.capacity})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>

          {targetBus && (
            <div className="flex items-baseline gap-2" aria-live="polite">
              <span className={`text-2xl font-bold tabular-nums ${over ? "text-red-700" : "text-neutral-900"}`}>
                {total}/{capacity}
              </span>
              <span className="text-xs text-neutral-500">
                {already} ya en el micro + {ticked.length} tildadas
              </span>
            </div>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {ticked.length > 0 && (
              <button
                type="button"
                onClick={() => onSelectedChange(new Set())}
                className="text-xs text-neutral-500 underline hover:text-neutral-800"
              >
                Limpiar tildes
              </button>
            )}
            <button
              type="button"
              disabled={saving || !targetBus || ticked.length === 0 || over}
              onClick={() => submit(false)}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
            >
              Asignar{ticked.length > 0 ? ` ${ticked.length}` : ""}
            </button>
            <button
              type="button"
              disabled={saving || !targetBus || ticked.length === 0 || over}
              onClick={() => submit(true)}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
            >
              Asignar y cerrar micro
            </button>
          </div>
        </div>

        {over && targetBus && (
          <p className="text-xs font-medium text-red-700" role="alert">
            Te pasás del cupo del micro {targetBus.bus_number} por {total - capacity}. Destildá {total - capacity} o
            cambiá de micro.
          </p>
        )}
        {error && (
          <p className="text-xs font-medium text-red-700" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 text-sm">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, apellido o nro"
            className="rounded-md border border-neutral-300 px-3 py-1.5"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-md border border-neutral-300 px-3 py-1.5"
          >
            <option value="code">Ordenar por nro</option>
            <option value="name">Ordenar por apellido</option>
          </select>
          <span className="flex items-center rounded-md bg-amber-50 px-3 py-1.5 text-amber-800">
            {pending.length} pendientes de micro
          </span>
          <span className="flex items-center rounded-md bg-green-50 px-3 py-1.5 text-green-800">
            {assignedCount} con micro
          </span>
          {independentCount > 0 && (
            <span className="flex items-center rounded-md bg-neutral-100 px-3 py-1.5 text-neutral-600">
              {independentCount} vuelven por su cuenta
            </span>
          )}
          {withdrawnCount > 0 && (
            <span className="flex items-center rounded-md bg-neutral-100 px-3 py-1.5 text-neutral-600">
              {withdrawnCount} se retiraron
            </span>
          )}
        </div>

        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-600">
              <tr>
                <th className="w-10 px-3 py-2" />
                <th className="px-3 py-2">Nro</th>
                <th className="px-3 py-2">Apellido, Nombre</th>
                <th className="px-3 py-2">Celular</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.map((p) => {
                const isTicked = selected.has(p.registrationId);
                return (
                  <tr
                    key={p.registrationId}
                    onClick={() => toggle(p.registrationId)}
                    className={`cursor-pointer ${isTicked ? "bg-blue-50" : "hover:bg-neutral-50"}`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={isTicked}
                        onChange={() => toggle(p.registrationId)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Tildar a ${p.lastName}, ${p.firstName}`}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-neutral-700">{p.pilgrimCode ?? "—"}</td>
                    <td className="px-3 py-2">
                      {p.lastName}, {p.firstName}
                    </td>
                    <td className="px-3 py-2">
                      <a
                        href={`tel:${p.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-neutral-600 hover:underline"
                      >
                        {p.phone}
                      </a>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-neutral-500">
                    {pending.length === 0 ? "No quedan personas pendientes de micro." : "Nadie coincide con la búsqueda."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
