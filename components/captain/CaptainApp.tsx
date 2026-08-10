"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, saveRoster, recordCheckin, type RosterEntry } from "@/lib/offline/db";
import { syncPendingCheckins } from "@/lib/offline/syncQueue";
import { createClient } from "@/lib/supabase/client";
import type { AssignmentDirection, CaptainRosterRow, CheckinEventType, StopRow } from "@/lib/types";

function hasAnyMedicalFlag(r: CaptainRosterRow) {
  return (
    r.has_allergies ||
    r.has_celiac ||
    r.has_diabetes ||
    r.has_hypertension ||
    r.has_respiratory_condition ||
    r.has_heart_condition ||
    r.has_other_condition ||
    r.takes_medication
  );
}

export function CaptainApp({
  eventId,
  busId,
  busNumber,
  recordedBy,
  stops,
  initialOutboundRoster,
  initialReturnRoster,
}: {
  eventId: string;
  busId: string;
  busNumber: number;
  recordedBy: string;
  stops: StopRow[];
  initialOutboundRoster: CaptainRosterRow[];
  initialReturnRoster: CaptainRosterRow[];
}) {
  const [direction, setDirection] = useState<AssignmentDirection>("outbound");
  const [stopId, setStopId] = useState(stops[0]?.id ?? "");
  const [lastRosterSync, setLastRosterSync] = useState<string | null>(null);
  const [syncingRoster, setSyncingRoster] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toEntries = (rows: CaptainRosterRow[], dir: AssignmentDirection): RosterEntry[] =>
    rows.map((r) => ({ ...r, busId, direction: dir, eventId }));

  // Primera carga: si el celular todavía no tiene el listado guardado
  // localmente, lo sembramos con lo que ya vino renderizado del server.
  useEffect(() => {
    (async () => {
      const existing = await db.roster.where({ busId }).count();
      if (existing === 0) {
        await saveRoster(toEntries(initialOutboundRoster, "outbound"));
        await saveRoster(toEntries(initialReturnRoster, "return"));
        setLastRosterSync(new Date().toISOString());
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync en segundo plano: al reconectar, cada 30s, y una vez al montar.
  useEffect(() => {
    const run = () => {
      syncPendingCheckins();
    };
    run();
    window.addEventListener("online", run);
    const interval = setInterval(run, 30000);
    return () => {
      window.removeEventListener("online", run);
      clearInterval(interval);
    };
  }, []);

  const roster =
    useLiveQuery(() => db.roster.where({ busId, direction }).toArray(), [busId, direction]) ?? [];
  const checkinsAtStop =
    useLiveQuery(
      () => db.checkins.where({ busId, direction, stopId }).toArray(),
      [busId, direction, stopId],
    ) ?? [];
  const pendingCount = useLiveQuery(() => db.checkins.where("synced").equals(0).count()) ?? 0;

  // Luján (última parada) es la única donde se embarca de Vuelta.
  const lastStop = stops[stops.length - 1];
  const availableStops = direction === "return" ? (lastStop ? [lastStop] : []) : stops;
  const isLastStop = stopId === lastStop?.id;
  const hideArrival = isLastStop && direction === "return";
  const hideDeparture = isLastStop && direction === "outbound";

  async function handleSyncRoster() {
    setSyncingRoster(true);
    try {
      const supabase = createClient();
      const [{ data: out }, { data: ret }] = await Promise.all([
        supabase.rpc("get_captain_roster", { p_bus_id: busId, p_direction: "outbound" }),
        supabase.rpc("get_captain_roster", { p_bus_id: busId, p_direction: "return" }),
      ]);
      await saveRoster(toEntries((out as CaptainRosterRow[]) ?? [], "outbound"));
      await saveRoster(toEntries((ret as CaptainRosterRow[]) ?? [], "return"));
      setLastRosterSync(new Date().toISOString());
    } finally {
      setSyncingRoster(false);
    }
  }

  async function handleCheckin(registrationId: string, eventType: CheckinEventType) {
    await recordCheckin({ registrationId, busId, stopId, direction, eventType, recordedBy });
  }

  function isChecked(registrationId: string, eventType: CheckinEventType) {
    return checkinsAtStop.some(
      (c) => c.registrationId === registrationId && c.eventType === eventType,
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="rounded-lg border border-neutral-200 bg-white p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">Micro {busNumber}</span>
          <span className={pendingCount > 0 ? "text-amber-700" : "text-green-700"}>
            {pendingCount > 0
              ? `${pendingCount} registros esperando conexión`
              : "Todo sincronizado"}
          </span>
        </div>
        <Link href={`/capitan/${eventId}/asistencia`} className="mt-2 block text-xs text-neutral-500 underline">
          Ver planilla de asistencia (con señal)
        </Link>
        <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
          <span>
            Listado sincronizado:{" "}
            {lastRosterSync ? new Date(lastRosterSync).toLocaleTimeString("es-AR") : "—"}
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleSyncRoster}
              disabled={syncingRoster}
              className="rounded-md border border-neutral-300 px-2 py-1"
            >
              {syncingRoster ? "Sincronizando..." : "Sincronizar listado"}
            </button>
            <button
              onClick={() => syncPendingCheckins()}
              className="rounded-md border border-neutral-300 px-2 py-1"
            >
              Reintentar envío
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 text-sm">
        <button
          onClick={() => setDirection("outbound")}
          className={`flex-1 rounded-md px-3 py-2 ${direction === "outbound" ? "bg-brand-ink text-white" : "border border-neutral-300"}`}
        >
          Ida
        </button>
        <button
          onClick={() => {
            setDirection("return");
            if (lastStop) setStopId(lastStop.id);
          }}
          className={`flex-1 rounded-md px-3 py-2 ${direction === "return" ? "bg-brand-ink text-white" : "border border-neutral-300"}`}
        >
          Vuelta
        </button>
      </div>

      <div>
        <label className="text-sm font-medium">Parada actual</label>
        <select
          value={stopId}
          onChange={(e) => setStopId(e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        >
          {availableStops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.sequence_order}. {s.name}
            </option>
          ))}
        </select>
      </div>

      <ul className="space-y-2">
        {roster.map((r) => {
          const arrived = isChecked(r.registration_id, "arrival");
          const departed = isChecked(r.registration_id, "departure");
          return (
            <li key={r.registration_id} className="rounded-lg border border-neutral-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <button
                  onClick={() =>
                    setExpandedId(expandedId === r.registration_id ? null : r.registration_id)
                  }
                  className="text-left text-sm font-medium"
                >
                  {r.last_name}, {r.first_name}
                  {hasAnyMedicalFlag(r) && <span className="ml-1 text-amber-600">⚠</span>}
                </button>
                <div className="flex gap-2">
                  {!hideArrival && (
                    <button
                      onClick={() => handleCheckin(r.registration_id, "arrival")}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold ${arrived ? "bg-green-700 text-white" : "border border-neutral-300"}`}
                    >
                      {arrived ? "✓ Llegó" : "Llegada"}
                    </button>
                  )}
                  {!hideDeparture && (
                    <button
                      onClick={() => handleCheckin(r.registration_id, "departure")}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold ${departed ? "bg-green-700 text-white" : "border border-neutral-300"}`}
                    >
                      {departed ? "✓ Salió" : "Salida"}
                    </button>
                  )}
                </div>
              </div>
              {expandedId === r.registration_id && (
                <div className="mt-2 space-y-1 rounded-md bg-neutral-50 p-2 text-xs text-neutral-700">
                  <p>
                    Contacto de emergencia: {r.emergency_contact_name} —{" "}
                    <a href={`tel:${r.emergency_contact_phone}`} className="underline">
                      {r.emergency_contact_phone}
                    </a>
                  </p>
                  {r.has_allergies && <p>Alergias: {r.allergies_detail}</p>}
                  {r.has_celiac && <p>Celiaquía</p>}
                  {r.has_diabetes && <p>Diabetes</p>}
                  {r.has_hypertension && <p>Hipertensión</p>}
                  {r.has_respiratory_condition && <p>Enfermedad respiratoria</p>}
                  {r.has_heart_condition && <p>Enfermedad cardíaca</p>}
                  {r.has_other_condition && <p>Otra: {r.other_condition_detail}</p>}
                  {r.takes_medication && <p>Medicación: {r.medication_detail}</p>}
                  {!hasAnyMedicalFlag(r) && <p>Sin datos médicos relevantes.</p>}
                </div>
              )}
            </li>
          );
        })}
        {roster.length === 0 && (
          <li className="rounded-lg border border-dashed border-neutral-300 p-4 text-center text-sm text-neutral-500">
            Sin listado sincronizado todavía. Tocá &quot;Sincronizar listado&quot; con señal
            antes de salir.
          </li>
        )}
      </ul>
    </div>
  );
}
