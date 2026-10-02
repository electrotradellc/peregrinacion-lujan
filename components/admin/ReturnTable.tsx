"use client";

import { useMemo, useState, useTransition } from "react";
import { assignReturnBusAction } from "@/lib/actions/returnBuses";
import type { ReturnBusRow } from "@/lib/types";

export interface ReturnRosterEntry {
  registrationId: string;
  pilgrimCode: number | null;
  lastName: string;
  firstName: string;
  phone: string;
  outboundBusNumber: number | null;
  arrivedAt: string | null; // llegada a la última parada de la ida
  returnBusId: string; // "" si todavía no tiene micro de vuelta
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

type Filter = "all" | "waiting" | "assigned" | "not-arrived";
type Sort = "code" | "name" | "bus";

function ReturnBusSelect({
  eventId,
  entry,
  buses,
  countByBus,
}: {
  eventId: string;
  entry: ReturnRosterEntry;
  buses: ReturnBusRow[];
  countByBus: Record<string, number>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <select
        value={entry.returnBusId}
        disabled={pending}
        onChange={(e) => {
          const formData = new FormData();
          formData.set("bus_id", e.target.value);
          setError(null);
          startTransition(async () => {
            const result = await assignReturnBusAction(eventId, entry.registrationId, formData);
            if (result.error) setError(result.error);
          });
        }}
        className="rounded-md border border-neutral-300 px-2 py-1 text-sm disabled:opacity-50"
      >
        <option value="">Sin asignar</option>
        {buses.map((b) => {
          const taken = countByBus[b.id] ?? 0;
          const isCurrent = b.id === entry.returnBusId;
          // Los completos y los que ya salieron no se ofrecen (salvo el que
          // la persona ya tiene, para que se siga viendo).
          const unavailable = !isCurrent && (taken >= b.capacity || b.departed_at !== null);
          return (
            <option key={b.id} value={b.id} disabled={unavailable}>
              Micro {b.bus_number} ({taken}/{b.capacity})
              {b.departed_at ? " — salió" : taken >= b.capacity ? " — completo" : ""}
            </option>
          );
        })}
      </select>
      {error && (
        <p className="max-w-xs text-xs font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function ReturnTable({
  eventId,
  roster,
  buses,
  countByBus,
  independentCount,
  withdrawnCount,
}: {
  eventId: string;
  roster: ReturnRosterEntry[];
  buses: ReturnBusRow[];
  countByBus: Record<string, number>;
  independentCount: number;
  withdrawnCount: number;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("code");

  const busNumberById = useMemo(() => new Map(buses.map((b) => [b.id, b.bus_number])), [buses]);

  const waitingCount = roster.filter((r) => r.arrivedAt && !r.returnBusId).length;
  const notArrivedCount = roster.filter((r) => !r.arrivedAt).length;
  const assignedCount = roster.filter((r) => r.returnBusId).length;

  const filtered = useMemo(() => {
    let rows = roster;
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.lastName.toLowerCase().includes(needle) ||
          r.firstName.toLowerCase().includes(needle) ||
          String(r.pilgrimCode ?? "").includes(needle),
      );
    }
    if (filter === "waiting") rows = rows.filter((r) => r.arrivedAt && !r.returnBusId);
    if (filter === "assigned") rows = rows.filter((r) => r.returnBusId);
    if (filter === "not-arrived") rows = rows.filter((r) => !r.arrivedAt);

    return [...rows].sort((a, b) => {
      if (sort === "name") {
        return a.lastName.localeCompare(b.lastName, "es") || a.firstName.localeCompare(b.firstName, "es");
      }
      if (sort === "bus") {
        const busA = busNumberById.get(a.returnBusId) ?? Infinity;
        const busB = busNumberById.get(b.returnBusId) ?? Infinity;
        return busA - busB || a.lastName.localeCompare(b.lastName, "es");
      }
      if (a.pilgrimCode === null && b.pilgrimCode === null) return 0;
      if (a.pilgrimCode === null) return 1;
      if (b.pilgrimCode === null) return -1;
      return a.pilgrimCode - b.pilgrimCode;
    });
  }, [roster, q, filter, sort, busNumberById]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, apellido o nro"
          className="rounded-md border border-neutral-300 px-3 py-1.5"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="rounded-md border border-neutral-300 px-3 py-1.5"
        >
          <option value="all">Todos</option>
          <option value="waiting">Esperando micro</option>
          <option value="assigned">Con micro</option>
          <option value="not-arrived">No llegaron a Luján</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="rounded-md border border-neutral-300 px-3 py-1.5"
        >
          <option value="code">Ordenar por nro</option>
          <option value="name">Ordenar por apellido</option>
          <option value="bus">Ordenar por micro de vuelta</option>
        </select>
        <span className="flex items-center rounded-md bg-amber-50 px-3 py-1.5 text-amber-800">
          {waitingCount} esperando micro
        </span>
        <span className="flex items-center rounded-md bg-green-50 px-3 py-1.5 text-green-800">
          {assignedCount} con micro
        </span>
        <span className="flex items-center rounded-md bg-neutral-100 px-3 py-1.5 text-neutral-600">
          {notArrivedCount} sin llegar a Luján
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
              <th className="px-3 py-2">Nro</th>
              <th className="px-3 py-2">Apellido, Nombre</th>
              <th className="px-3 py-2">Celular</th>
              <th className="px-3 py-2">Micro (ida)</th>
              <th className="px-3 py-2">Llegó a Luján</th>
              <th className="px-3 py-2">Micro (vuelta)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.map((r) => (
              <tr key={r.registrationId}>
                <td className="px-3 py-2 font-mono text-neutral-700">{r.pilgrimCode ?? "—"}</td>
                <td className="px-3 py-2">
                  {r.lastName}, {r.firstName}
                </td>
                <td className="px-3 py-2">
                  <a href={`tel:${r.phone}`} className="text-neutral-600 hover:underline">
                    {r.phone}
                  </a>
                </td>
                <td className="px-3 py-2 text-neutral-700">{r.outboundBusNumber ?? "—"}</td>
                <td className="px-3 py-2">
                  {r.arrivedAt ? (
                    <span className="text-xs text-green-700">{formatTime(r.arrivedAt)}</span>
                  ) : (
                    <span className="text-xs text-neutral-400">sin marcar</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {r.arrivedAt || r.returnBusId ? (
                    <ReturnBusSelect eventId={eventId} entry={r} buses={buses} countByBus={countByBus} />
                  ) : (
                    <span className="text-xs text-neutral-400">Falta marcar la llegada</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-neutral-500">
                  Nadie coincide con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
