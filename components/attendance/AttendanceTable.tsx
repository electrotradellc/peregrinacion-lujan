"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordAttendanceAction, markNoShowAction } from "@/lib/actions/attendance";
import type { AssignmentDirection } from "@/lib/types";

export interface AttendanceRosterEntry {
  registrationId: string;
  busId: string;
  busNumber: number;
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
  direction,
  stopId,
  roster,
  checkinsAtStop,
  supportVehicleRegistrationIds,
  isPresentationStop = false,
  isFinalStop = false,
}: {
  eventId: string;
  direction: AssignmentDirection;
  stopId: string;
  roster: AttendanceRosterEntry[];
  checkinsAtStop: AttendanceCheckinEntry[];
  supportVehicleRegistrationIds: string[];
  isPresentationStop?: boolean;
  isFinalStop?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "no-arrival" | "no-departure">("all");
  const [sort, setSort] = useState<"code" | "name" | "bus">("code");

  const showBusColumn = useMemo(() => new Set(roster.map((r) => r.busId)).size > 1, [roster]);

  // En Luján (parada final) no tiene sentido "Salida" de ida ni "Llegada" de
  // vuelta — ahí el viaje de ida termina y el de vuelta arranca. "Sigue en
  // Micro" solo aplica en Ida (en Vuelta la única parada es Luján).
  const hideArrival = isFinalStop && direction === "return";
  const hideDeparture = isFinalStop && direction === "outbound";
  const hideSupportVehicle = direction === "return";

  const findCheckin = (registrationId: string, eventType: "arrival" | "departure") =>
    checkinsAtStop.find((c) => c.registrationId === registrationId && c.eventType === eventType);

  const supportSet = useMemo(() => new Set(supportVehicleRegistrationIds), [supportVehicleRegistrationIds]);

  // "No se presentaron" reutiliza el mismo chequeo de "arrival" que en las
  // demás paradas — en la parada de presentación, "llegó" = "se presentó".
  const notPresentedCount = useMemo(
    () => roster.filter((r) => !findCheckin(r.registrationId, "arrival")).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roster, checkinsAtStop],
  );

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
    if (!hideArrival && filter === "no-arrival") {
      rows = rows.filter((r) => !findCheckin(r.registrationId, "arrival"));
    }
    if (!isPresentationStop && !hideDeparture && filter === "no-departure") {
      rows = rows.filter((r) => !findCheckin(r.registrationId, "departure"));
    }
    // El filtro de "no se presentaron" siempre se ordena por micro, sin
    // depender de qué tenga elegido el selector de orden.
    const effectiveSort = isPresentationStop && filter === "no-arrival" ? "bus" : sort;
    return [...rows].sort((a, b) => {
      if (effectiveSort === "bus") {
        return a.busNumber - b.busNumber || a.lastName.localeCompare(b.lastName, "es");
      }
      if (effectiveSort === "code") {
        if (a.pilgrimCode === null && b.pilgrimCode === null) return 0;
        if (a.pilgrimCode === null) return 1;
        if (b.pilgrimCode === null) return -1;
        return a.pilgrimCode - b.pilgrimCode;
      }
      return a.lastName.localeCompare(b.lastName, "es") || a.firstName.localeCompare(b.firstName, "es");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, checkinsAtStop, q, filter, sort, isPresentationStop, hideArrival, hideDeparture]);

  function mark(registrationId: string, busId: string, eventType: "arrival" | "departure" | "support_vehicle") {
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
        {!hideArrival && (
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="rounded-md border border-neutral-300 px-3 py-1.5"
          >
            <option value="all">Todos</option>
            <option value="no-arrival">{isPresentationStop ? "No se presentaron" : "No llegaron"}</option>
            {!isPresentationStop && !hideDeparture && <option value="no-departure">No salieron</option>}
          </select>
        )}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="rounded-md border border-neutral-300 px-3 py-1.5"
        >
          <option value="code">Ordenar por nro</option>
          <option value="name">Ordenar por apellido</option>
          {showBusColumn && <option value="bus">Ordenar por micro</option>}
        </select>
        {isPresentationStop && (
          <span className="flex items-center rounded-md bg-amber-50 px-3 py-1.5 text-amber-800">
            {notPresentedCount} sin presentar
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr>
              {showBusColumn && <th className="px-3 py-2">Micro</th>}
              <th className="px-3 py-2">Nro</th>
              <th className="px-3 py-2">Apellido, Nombre</th>
              <th className="px-3 py-2">Celular</th>
              {isPresentationStop ? (
                <th className="px-3 py-2">Presentación</th>
              ) : (
                <>
                  {!hideArrival && <th className="px-3 py-2">Llegada</th>}
                  {!hideDeparture && <th className="px-3 py-2">Salida</th>}
                  {!hideSupportVehicle && <th className="px-3 py-2">Sigue en Micro</th>}
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
                  {showBusColumn && <td className="px-3 py-2 text-neutral-700">{r.busNumber}</td>}
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
                            onClick={() => mark(r.registrationId, r.busId, "arrival")}
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
                      {!hideArrival && (
                        <td className="px-3 py-2">
                          {arrival ? (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                              {formatTime(arrival.recordedAt)}
                            </span>
                          ) : (
                            <button
                              disabled={pending && pendingKey === `${r.registrationId}-arrival`}
                              onClick={() => mark(r.registrationId, r.busId, "arrival")}
                              className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100 disabled:opacity-50"
                            >
                              Marcar llegada
                            </button>
                          )}
                        </td>
                      )}
                      {!hideDeparture && (
                        <td className="px-3 py-2">
                          {departure ? (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                              {formatTime(departure.recordedAt)}
                            </span>
                          ) : (
                            <button
                              disabled={pending && pendingKey === `${r.registrationId}-departure`}
                              onClick={() => mark(r.registrationId, r.busId, "departure")}
                              className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100 disabled:opacity-50"
                            >
                              Marcar salida
                            </button>
                          )}
                        </td>
                      )}
                      {!hideSupportVehicle && (
                        <td className="px-3 py-2">
                          {!inSupportVehicle && (
                            <button
                              disabled={pending && pendingKey === `${r.registrationId}-support_vehicle`}
                              onClick={() => mark(r.registrationId, r.busId, "support_vehicle")}
                              className="rounded-md border border-amber-300 px-2 py-1 text-xs text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                            >
                              Sigue en Micro
                            </button>
                          )}
                        </td>
                      )}
                    </>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={
                    (showBusColumn ? 1 : 0) +
                    (isPresentationStop
                      ? 4
                      : 3 + [!hideArrival, !hideDeparture, !hideSupportVehicle].filter(Boolean).length)
                  }
                  className="px-3 py-6 text-center text-neutral-500"
                >
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
