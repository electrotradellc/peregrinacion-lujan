"use client";

import { useMemo, useState, useTransition } from "react";
import { assignReturnBusAction } from "@/lib/actions/returnBuses";
import type { ReturnBusRow } from "@/lib/types";
import { ReturnBusControls, formatTime } from "@/components/admin/ReturnBusesPanel";
import { comparePilgrimCode, matchesPerson, type ReturnAssignedPerson } from "@/components/admin/returnTypes";

type StatusFilter = "all" | "open" | "closed";

// Quitar a alguien del micro o pasarlo a otro (también en micros que ya
// salieron: sirve para corregir errores de asignación).
function PassengerActions({
  eventId,
  person,
  buses,
  countByBus,
}: {
  eventId: string;
  person: ReturnAssignedPerson;
  buses: ReturnBusRow[];
  countByBus: Record<string, number>;
}) {
  const [saving, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function assign(busId: string) {
    const formData = new FormData();
    formData.set("bus_id", busId);
    setError(null);
    startTransition(async () => {
      const result = await assignReturnBusAction(eventId, person.registrationId, formData);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value=""
        disabled={saving}
        onChange={(e) => e.target.value && assign(e.target.value)}
        className="rounded-md border border-neutral-300 px-2 py-1 text-xs disabled:opacity-50"
        aria-label="Mover a otro micro"
      >
        <option value="">Mover a…</option>
        {buses
          .filter((b) => b.id !== person.returnBusId)
          .map((b) => {
            const taken = countByBus[b.id] ?? 0;
            return (
              <option key={b.id} value={b.id} disabled={taken >= b.capacity}>
                Micro {b.bus_number} ({taken}/{b.capacity})
                {b.departed_at ? " — salió" : ""}
                {taken >= b.capacity ? " — completo" : ""}
              </option>
            );
          })}
      </select>
      <button
        type="button"
        disabled={saving}
        onClick={() => {
          if (window.confirm(`¿Sacar a ${person.lastName}, ${person.firstName} de este micro?`)) assign("");
        }}
        className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        Sacar
      </button>
      {error && (
        <p className="w-full text-xs font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// Solapa "Micros": todos los micros de vuelta (abiertos y los que ya salieron)
// con su gente, para ver, filtrar y corregir asignaciones.
export function ReturnBoard({
  eventId,
  buses,
  countByBus,
  assigned,
  onAddPeople,
}: {
  eventId: string;
  buses: ReturnBusRow[];
  countByBus: Record<string, number>;
  assigned: ReturnAssignedPerson[];
  onAddPeople: (busId: string) => void;
}) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const peopleByBus = useMemo(() => {
    const map = new Map<string, ReturnAssignedPerson[]>();
    for (const p of assigned) {
      const list = map.get(p.returnBusId) ?? [];
      list.push(p);
      map.set(p.returnBusId, list);
    }
    for (const list of map.values()) list.sort(comparePilgrimCode);
    return map;
  }, [assigned]);

  const openCount = buses.filter((b) => b.departed_at === null).length;
  const closedCount = buses.length - openCount;
  const needle = q.trim().toLowerCase();

  const visible = buses.filter((b) => {
    if (status === "open" && b.departed_at !== null) return false;
    if (status === "closed" && b.departed_at === null) return false;
    if (!needle) return true;
    return (
      String(b.bus_number) === needle ||
      (peopleByBus.get(b.id) ?? []).some((p) => matchesPerson(p, needle))
    );
  });

  function toggle(busId: string) {
    const next = new Set(expanded);
    if (next.has(busId)) next.delete(busId);
    else next.add(busId);
    setExpanded(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div className="flex overflow-hidden rounded-md border border-neutral-300">
          {(
            [
              ["all", `Todos (${buses.length})`],
              ["open", `Abiertos (${openCount})`],
              ["closed", `Salieron (${closedCount})`],
            ] as [StatusFilter, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              className={`px-3 py-1.5 ${
                status === value ? "bg-neutral-900 font-medium text-white" : "bg-white hover:bg-neutral-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nº de micro, o nombre / nro de una persona"
          className="min-w-64 rounded-md border border-neutral-300 px-3 py-1.5"
        />
      </div>

      {visible.length === 0 && (
        <p className="rounded-lg border border-neutral-200 bg-white px-4 py-6 text-center text-sm text-neutral-500">
          {buses.length === 0 ? "Todavía no hay micros de vuelta." : "Ningún micro coincide con el filtro."}
        </p>
      )}

      {visible.map((b) => {
        const people = peopleByBus.get(b.id) ?? [];
        const taken = countByBus[b.id] ?? 0;
        const isOpen = expanded.has(b.id) || needle !== "";
        const departed = b.departed_at !== null;
        return (
          <section key={b.id} className="rounded-lg border border-neutral-200 bg-white">
            <button
              type="button"
              onClick={() => toggle(b.id)}
              aria-expanded={isOpen}
              className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left"
            >
              <span className="text-neutral-400" aria-hidden>
                {isOpen ? "▾" : "▸"}
              </span>
              <span className="font-medium">Micro {b.bus_number}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  taken >= b.capacity ? "bg-green-100 text-green-800" : "bg-neutral-100 text-neutral-700"
                }`}
              >
                {taken}/{b.capacity}
              </span>
              {departed ? (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                  Salió {formatTime(b.departed_at!)}
                </span>
              ) : (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Abierto</span>
              )}
            </button>

            {isOpen && (
              <div className="space-y-3 border-t border-neutral-100 px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <ReturnBusControls eventId={eventId} bus={b} taken={taken} />
                  <button
                    type="button"
                    onClick={() => onAddPeople(b.id)}
                    className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium hover:bg-neutral-50"
                  >
                    Agregar personas
                  </button>
                </div>

                {people.length === 0 ? (
                  <p className="text-sm text-neutral-500">Sin personas asignadas.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="text-left text-neutral-500">
                      <tr>
                        <th className="py-1 pr-3">Nro</th>
                        <th className="py-1 pr-3">Apellido, Nombre</th>
                        <th className="py-1 pr-3">Celular</th>
                        <th className="py-1" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {people.map((p) => (
                        <tr key={p.registrationId}>
                          <td className="py-1.5 pr-3 font-mono text-neutral-700">{p.pilgrimCode ?? "—"}</td>
                          <td className="py-1.5 pr-3">
                            {p.lastName}, {p.firstName}
                            {p.returnsIndependently && (
                              <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">
                                vuelve por su cuenta
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 pr-3">
                            <a href={`tel:${p.phone}`} className="text-neutral-600 hover:underline">
                              {p.phone}
                            </a>
                          </td>
                          <td className="py-1.5">
                            <PassengerActions
                              eventId={eventId}
                              person={p}
                              buses={buses}
                              countByBus={countByBus}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
