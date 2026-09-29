"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  replaceRoster,
  recordCheckin,
  getRosterSavedAt,
  setRosterSavedAt,
  type RosterEntry,
} from "@/lib/offline/db";
import { syncPendingCheckins } from "@/lib/offline/syncQueue";
import { createClient } from "@/lib/supabase/client";
import type { CaptainRosterRow, CheckinEventType, StopRow } from "@/lib/types";

// El referente solo marca la Ida; la Vuelta la maneja Admin.
const DIRECTION = "outbound" as const;

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

function formatSavedAt(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

// Modo sin conexión: las marcas se guardan en el celular (IndexedDB) y se
// envían solas cuando hay señal. El listado y las marcas ya hechas los deja
// preparados la planilla con señal (OfflineModeBanner) mientras se usa.
export function CaptainApp({
  eventId,
  busId,
  busNumber,
  recordedBy,
  stops,
  initialRoster,
}: {
  eventId: string;
  busId: string;
  busNumber: number;
  recordedBy: string;
  stops: StopRow[];
  initialRoster: CaptainRosterRow[];
}) {
  const [stopId, setStopId] = useState(stops[0]?.id ?? "");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [updatingRoster, setUpdatingRoster] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  // Para avisar "volvió la señal" solo si en algún momento se cortó — si el
  // referente entró a este modo teniendo señal, no hay nada que avisar.
  const [wasOffline, setWasOffline] = useState(false);
  const [returning, setReturning] = useState(false);
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "no-arrival" | "no-departure">("all");
  const [sort, setSort] = useState<"code" | "name">("code");

  const toEntries = (rows: CaptainRosterRow[]): RosterEntry[] =>
    rows.map((r) => ({ ...r, busId, direction: DIRECTION, eventId }));

  // Si el celular todavía no tiene el listado guardado (nunca abrió la
  // planilla), se usa lo que vino con la página.
  useEffect(() => {
    (async () => {
      const existing = await db.roster.where({ busId }).count();
      if (existing === 0 && initialRoster.length > 0) {
        await replaceRoster(busId, toEntries(initialRoster));
        setRosterSavedAt(busId);
      }
      setSavedAt(getRosterSavedAt(busId));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const update = () => {
      const isOnline = navigator.onLine;
      setOnline(isOnline);
      if (!isOnline) setWasOffline(true);
    };
    update();
    const run = () => {
      update();
      syncPendingCheckins();
    };
    run();
    window.addEventListener("online", run);
    window.addEventListener("offline", update);
    const interval = setInterval(run, 30000);
    return () => {
      window.removeEventListener("online", run);
      window.removeEventListener("offline", update);
      clearInterval(interval);
    };
  }, []);

  const roster =
    useLiveQuery(() => db.roster.where({ busId, direction: DIRECTION }).toArray(), [busId]) ?? [];
  const checkinsAtStop =
    useLiveQuery(
      () => db.checkins.where({ busId, direction: DIRECTION, stopId }).toArray(),
      [busId, stopId],
    ) ?? [];
  const pendingCount = useLiveQuery(() => db.checkins.where("synced").equals(0).count()) ?? 0;

  const lastStop = stops[stops.length - 1];
  const currentStop = stops.find((s) => s.id === stopId);
  const isPresentationStop = currentStop?.is_presentation_stop ?? false;
  // En Luján termina la ida: no hay salida. En la parada de presentación
  // solo se marca que se presentó.
  const hideDeparture = stopId === lastStop?.id || isPresentationStop;

  const isChecked = (registrationId: string, eventType: CheckinEventType) =>
    checkinsAtStop.some((c) => c.registrationId === registrationId && c.eventType === eventType);

  const notArrivedCount = roster.filter((r) => !isChecked(r.registration_id, "arrival")).length;
  const notDepartedCount = roster.filter((r) => !isChecked(r.registration_id, "departure")).length;

  const filtered = useMemo(() => {
    let rows = roster;
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.last_name.toLowerCase().includes(needle) ||
          r.first_name.toLowerCase().includes(needle) ||
          String(r.pilgrim_code ?? "").includes(needle),
      );
    }
    if (filter === "no-arrival") {
      rows = rows.filter((r) => !isChecked(r.registration_id, "arrival"));
    }
    if (filter === "no-departure" && !hideDeparture) {
      rows = rows.filter((r) => !isChecked(r.registration_id, "departure"));
    }
    return [...rows].sort((a, b) => {
      if (sort === "code") {
        if (a.pilgrim_code === null && b.pilgrim_code === null) return 0;
        if (a.pilgrim_code === null) return 1;
        if (b.pilgrim_code === null) return -1;
        return a.pilgrim_code - b.pilgrim_code;
      }
      return a.last_name.localeCompare(b.last_name, "es") || a.first_name.localeCompare(b.first_name, "es");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, checkinsAtStop, q, filter, sort, hideDeparture]);

  async function handleUpdateRoster() {
    setUpdatingRoster(true);
    setUpdateError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_captain_roster", {
        p_bus_id: busId,
        p_direction: DIRECTION,
      });
      if (error) throw error;
      await replaceRoster(busId, toEntries((data as CaptainRosterRow[]) ?? []));
      setRosterSavedAt(busId);
      setSavedAt(getRosterSavedAt(busId));
    } catch {
      setUpdateError("No se pudo actualizar. Revisá la señal y probá de nuevo.");
    } finally {
      setUpdatingRoster(false);
    }
  }

  // Se mandan las marcas pendientes antes de volver, así la planilla (que
  // lee del server) ya las muestra al abrir. No se cambia de pantalla sola:
  // en la ruta la señal va y viene, y saltar de pantalla en medio de una
  // marca confundiría más.
  async function handleBackToSheet() {
    setReturning(true);
    try {
      await syncPendingCheckins();
    } finally {
      router.push(`/capitan/${eventId}/asistencia`);
    }
  }

  async function handleCheckin(registrationId: string, eventType: CheckinEventType) {
    await recordCheckin({ registrationId, busId, stopId, direction: DIRECTION, eventType, recordedBy });
    if (navigator.onLine) syncPendingCheckins();
  }

  return (
    <div className="space-y-4 pb-24">
      {online && wasOffline && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-900">
          <p className="font-semibold">Volvió la señal.</p>
          <p className="mt-1">
            Podés volver a la planilla: ahí también podés deshacer marcas, marcar &quot;micro de
            apoyo&quot; y &quot;no se presentó&quot;.
          </p>
          <button
            type="button"
            onClick={handleBackToSheet}
            disabled={returning}
            className="mt-3 w-full rounded-md bg-green-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {returning ? "Enviando marcas y volviendo..." : "Volver a la planilla"}
          </button>
        </div>
      )}

      <div className="rounded-lg border border-neutral-200 bg-white p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">Modo sin conexión · Micro {busNumber}</span>
          <Link href={`/capitan/${eventId}/asistencia`} className="text-xs text-brand-ink underline">
            Volver a la planilla
          </Link>
        </div>
        <p className="text-xs text-neutral-500">
          Las marcas se guardan en este celular y se envían solas cuando hay señal.
        </p>

        {pendingCount > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <span>
              {pendingCount} marca{pendingCount === 1 ? "" : "s"} guardada{pendingCount === 1 ? "" : "s"} en
              el celular, todavía sin enviar.
            </span>
            <button
              onClick={() => syncPendingCheckins()}
              className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-medium"
            >
              Enviar ahora
            </button>
          </div>
        ) : (
          <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
            ✓ Todas las marcas están enviadas.
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
          <span>Listado guardado: {savedAt ? formatSavedAt(savedAt) : "—"}</span>
          <button
            onClick={handleUpdateRoster}
            disabled={updatingRoster || !online}
            className="rounded-md border border-neutral-300 px-2 py-1 disabled:opacity-50"
          >
            {updatingRoster ? "Actualizando..." : online ? "Actualizar listado" : "Actualizar listado (necesita señal)"}
          </button>
        </div>
        {updateError && <p className="text-xs text-red-600">{updateError}</p>}
      </div>

      <div>
        <label className="text-sm font-medium">Parada actual</label>
        <select
          value={stopId}
          onChange={(e) => {
            setStopId(e.target.value);
            setFilter("all");
          }}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        >
          {stops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.sequence_order}. {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, apellido o nro"
          className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-1.5"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="rounded-md border border-neutral-300 px-3 py-1.5"
        >
          <option value="all">Todos</option>
          <option value="no-arrival">{isPresentationStop ? "No se presentaron" : "No llegaron"}</option>
          {!hideDeparture && <option value="no-departure">No salieron</option>}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="rounded-md border border-neutral-300 px-3 py-1.5"
        >
          <option value="code">Ordenar por nro</option>
          <option value="name">Ordenar por apellido</option>
        </select>
        <span className="flex items-center rounded-md bg-amber-50 px-3 py-1.5 text-amber-800">
          {notArrivedCount} {isPresentationStop ? "sin presentar" : "sin llegada"}
        </span>
        {!hideDeparture && (
          <span className="flex items-center rounded-md bg-amber-50 px-3 py-1.5 text-amber-800">
            {notDepartedCount} sin salida
          </span>
        )}
      </div>

      <ul className="space-y-2">
        {filtered.map((r) => {
          const arrived = isChecked(r.registration_id, "arrival");
          const departed = isChecked(r.registration_id, "departure");
          return (
            <li key={r.registration_id} className="rounded-lg border border-neutral-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() =>
                    setExpandedId(expandedId === r.registration_id ? null : r.registration_id)
                  }
                  className="text-left text-sm font-medium"
                >
                  <span className="mr-1 font-mono text-neutral-500">{r.pilgrim_code ?? "—"}</span>
                  {r.last_name}, {r.first_name}
                  {hasAnyMedicalFlag(r) && <span className="ml-1 text-amber-600">⚠</span>}
                </button>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => handleCheckin(r.registration_id, "arrival")}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold ${arrived ? "bg-green-700 text-white" : "border border-neutral-300"}`}
                  >
                    {isPresentationStop
                      ? arrived
                        ? "✓ Presente"
                        : "Presente"
                      : arrived
                        ? "✓ Llegó"
                        : "Llegada"}
                  </button>
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
            Todavía no hay listado guardado en este celular. Abrí la planilla con señal antes de
            salir y se guarda solo.
          </li>
        )}
        {roster.length > 0 && filtered.length === 0 && (
          <li className="rounded-lg border border-dashed border-neutral-300 p-4 text-center text-sm text-neutral-500">
            Nadie coincide con la búsqueda o el filtro.
          </li>
        )}
      </ul>
    </div>
  );
}
