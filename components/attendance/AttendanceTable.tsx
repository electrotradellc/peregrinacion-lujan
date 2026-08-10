"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordAttendanceAction, markNoShowAction } from "@/lib/actions/attendance";
import type { AssignmentDirection } from "@/lib/types";

export interface AttendanceRosterEntry {
  registrationId: string;
  pilgrimCode: number | null;
  lastName: string;
  firstName: string;
  phone: string;
}

export interface AttendanceCheckinEntry {
  registrationId: string;
  eventType: "arrival" | "departure" | "support_vehicle";
  recordedAt: string;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export function AttendanceTable({
  eventId,
  busId,
  direction,
  stopId,
  roster,
  checkinsAtStop,
  supportVehicleRegistrationIds,
  isPresentationStop = false,
}: {
  eventId: string;
  busId: string;
  direction: AssignmentDirection;
  stopId: string;
  roster: AttendanceRosterEntry[];
  checkinsAtStop: AttendanceCheckinEntry[];
  supportVehicleRegistrationIds: string[];
  isPresentationStop?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "no-arrival" | "no-departure">("all");
  const [sort, setSort] = useState<"code" | "name">("code");

  const findCheckin = (registrationId: string, eventType: "arrival" | "departure") =>
    checkinsAtStop.find((c) => c.registrationId === registrationId && c.eventType === eventType);

  const supportSet = useMemo(() => new Set(supportVehicleRegistrationIds), [supportVehicleRegistrationIds]);

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
    if (!isPresentationStop && filter === "no-arrival") {
      rows = rows.filter((r) => !findCheckin(r.registrationId, "arrival"));
    }
    if (!isPresentationStop && filter === "no-departure") {
      rows = rows.filter((r) => !findCheckin(r.registrationId, "departure"));
    }
    return [...rows].sort((a, b) => {
      if (sort === "code") {
        if (a.pilgrimCode === null && b.pilgrimCode === null) return 0;
        if (a.pilgrimCode === null) return 1;
        if (b.pilgrimCode === null) return -1;
        return a.pilgrimCode - b.pilgrimCode;
      }
      return a.lastName.localeCompare(b.lastName, "es") || a.firstName.localeCompare(b.firstName, "es");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, checkinsAtStop, q, filter, sort, isPresentationStop]);

  function mark(registrationId: string, eventType: "arrival" | "departure" | "support_vehicle") {
    const key = `${registrationId}-${eventType}`;
    setPendingKey(key);
    startTransition(async () => {
      try {
        await recordAttendanceAction({ eventId, busId, direction, stopId, registrationId, eventType });
      } finally {
        setPendingKey(null);
      }
    });
  }

  function noShow(registrationId: string) {
    if (!window.confirm("¿Marcar que no se presentó? Va a desaparecer de las asignaciones de micro y del resto de las paradas, igual que una cancelación.")) {
      return;
    }
    const key = `${registrationId}-no-show`;
    setPendingKey(key);
    startTransition(async () => {
      try {
        await markNoShowAction(eventId, registrationId);
        router.refresh();
      } finally {
        setPendingKey(null);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, apellido o nro"
          className="rounded-md border border-neutral-300 px-3 py-1.5"
        />
        {!isPresentationStop && (
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="rounded-md border border-neutral-300 px-3 py-1.5"
          >
            <option value="all">Todos</option>
            <option value="no-arrival">No llegaron</option>
            <option value="no-departure">No salieron</option>
          </select>
        )}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="rounded-md border border-neutral-300 px-3 py-1.5"
        >
          <option value="code">Ordenar por nro</option>
          <option value="name">Ordenar por apellido</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr>
              <th className="px-3 py-2">Nro</th>
              <th className="px-3 py-2">Apellido, Nombre</th>
              <th className="px-3 py-2">Celular</th>
              {isPresentationStop ? (
                <th className="px-3 py-2">Presentación</th>
              ) : (
                <>
                  <th className="px-3 py-2">Llegada</th>
                  <th className="px-3 py-2">Salida</th>
                  <th className="px-3 py-2">Sigue en Micro</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.map((r) => {
              const arrival = findCheckin(r.registrationId, "arrival");
              const departure = findCheckin(r.registrationId, "departure");
              const inSupportVehicle = supportSet.has(r.registrationId);
              return (
                <tr key={r.registrationId} className={inSupportVehicle ? "bg-amber-50" : undefined}>
                  <td className="px-3 py-2 font-mono text-neutral-700">{r.pilgrimCode ?? "—"}</td>
                  <td className="px-3 py-2">
                    {r.lastName}, {r.firstName}
                    {inSupportVehicle && (
                      <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">
                        🚐 en micro de apoyo
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <a href={`tel:${r.phone}`} className="text-neutral-600 hover:underline">
                      {r.phone}
                    </a>
                  </td>
                  {isPresentationStop ? (
                    <td className="px-3 py-2">
                      {arrival ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                          Se presentó — {formatTime(arrival.recordedAt)}
                        </span>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            disabled={pending && pendingKey === `${r.registrationId}-arrival`}
                            onClick={() => mark(r.registrationId, "arrival")}
                            className="rounded-md border border-green-300 px-2 py-1 text-xs text-green-800 hover:bg-green-50 disabled:opacity-50"
                          >
                            Se presentó
                          </button>
                          <button
                            disabled={pending && pendingKey === `${r.registrationId}-no-show`}
                            onClick={() => noShow(r.registrationId)}
                            className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            No se presentó
                          </button>
                        </div>
                      )}
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-2">
                        {arrival ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                            {formatTime(arrival.recordedAt)}
                          </span>
                        ) : (
                          <button
                            disabled={pending && pendingKey === `${r.registrationId}-arrival`}
                            onClick={() => mark(r.registrationId, "arrival")}
                            className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100 disabled:opacity-50"
                          >
                            Marcar llegada
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {departure ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                            {formatTime(departure.recordedAt)}
                          </span>
                        ) : (
                          <button
                            disabled={pending && pendingKey === `${r.registrationId}-departure`}
                            onClick={() => mark(r.registrationId, "departure")}
                            className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100 disabled:opacity-50"
                          >
                            Marcar salida
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {!inSupportVehicle && (
                          <button
                            disabled={pending && pendingKey === `${r.registrationId}-support_vehicle`}
                            onClick={() => mark(r.registrationId, "support_vehicle")}
                            className="rounded-md border border-amber-300 px-2 py-1 text-xs text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                          >
                            Sigue en Micro
                          </button>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={isPresentationStop ? 4 : 6} className="px-3 py-6 text-center text-neutral-500">
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
