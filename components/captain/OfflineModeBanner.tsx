"use client";

import { useEffect, useState } from "react";
import { replaceRoster, replaceSyncedCheckins } from "@/lib/offline/db";
import {
  ATTENDANCE_SAVE_FAILED_EVENT,
  ATTENDANCE_SAVE_OK_EVENT,
} from "@/components/attendance/AttendanceTable";
import type { AttendanceCheckinRow, CaptainRosterRow } from "@/lib/types";

// Vive arriba de la planilla del referente. Mientras hay señal, deja
// preparado el modo sin conexión en segundo plano: guarda el listado y las
// marcas ya hechas en el celular, y pide una vez la página sin conexión para
// que el service worker la tenga cacheada. Así, si se corta la señal, el
// modo sin conexión abre con todo al día sin que el referente haga nada.
export function OfflineModeBanner({
  eventId,
  busId,
  roster,
  checkins,
}: {
  eventId: string;
  busId: string;
  roster: CaptainRosterRow[];
  checkins: AttendanceCheckinRow[];
}) {
  const [online, setOnline] = useState(true);
  // Con señal débil el celular sigue diciendo "conectado" (nunca dispara
  // "offline"), pero las marcas no se guardan: ese caso lo detecta la tabla
  // cuando una marca falla, y acá se ofrece el modo sin conexión igual.
  const [saveFailed, setSaveFailed] = useState(false);
  const offlineUrl = `/capitan/${eventId}`;

  // Carga de página completa a propósito, no router.push: sin señal, la
  // navegación del router intenta pedir datos al server y falla, mientras
  // que una carga completa la resuelve el service worker desde su copia.
  const openOfflineMode = () => {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(offlineUrl);
  };

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    const onFailed = () => setSaveFailed(true);
    const onOk = () => setSaveFailed(false);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener(ATTENDANCE_SAVE_FAILED_EVENT, onFailed);
    window.addEventListener(ATTENDANCE_SAVE_OK_EVENT, onOk);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener(ATTENDANCE_SAVE_FAILED_EVENT, onFailed);
      window.removeEventListener(ATTENDANCE_SAVE_OK_EVENT, onOk);
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await replaceRoster(
          busId,
          roster.map((r) => ({ ...r, busId, direction: "outbound" as const, eventId })),
        );
        await replaceSyncedCheckins(
          busId,
          checkins.map((c) => ({
            id: c.id,
            registrationId: c.registration_id,
            busId: c.bus_id,
            stopId: c.stop_id,
            direction: c.direction,
            eventType: c.event_type,
            recordedAt: c.recorded_at,
            recordedBy: c.recorded_by,
            deviceId: c.device_id ?? "server",
            clientCreatedAt: c.client_created_at,
            synced: 1 as const,
          })),
        );
      } catch {
        // IndexedDB no disponible (ej. navegación privada) — la planilla
        // sigue funcionando igual, solo no queda preparado el respaldo.
      }
    })();
  }, [eventId, busId, roster, checkins]);

  // Una sola vez por visita: con cada marca la planilla se refresca, y no
  // hace falta volver a pedir la página sin conexión cada vez.
  useEffect(() => {
    fetch(offlineUrl, { credentials: "same-origin" }).catch(() => {});
  }, [offlineUrl]);

  if (!online || saveFailed) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">{online ? "Parece que no hay buena señal." : "Estás sin señal."}</p>
        <p className="mt-1">
          {online
            ? "Una marca no se pudo guardar. "
            : "Las marcas de esta planilla no se van a guardar. "}
          Pasá al modo sin conexión: guarda las marcas en el celular y las envía solas cuando
          vuelva la señal.
        </p>
        <button
          type="button"
          onClick={openOfflineMode}
          className="mt-3 w-full rounded-md bg-amber-600 px-4 py-2 font-semibold text-white"
        >
          Abrir modo sin conexión
        </button>
      </div>
    );
  }

  return null;
}
