import { db, getPendingCheckins, markSynced } from "./db";

const BATCH_SIZE = 25;

export interface SyncResult {
  attempted: number;
  synced: number;
  failed: number;
}

// Manda los check-ins pendientes al server en lotes chicos. Se puede llamar
// las veces que haga falta (al reconectar, cada 30s, a mano) sin riesgo de
// duplicar nada: el server es idempotente tanto por `id` como por la clave
// de negocio (registration_id, bus_id, stop_id, direction, event_type).
export async function syncPendingCheckins(): Promise<SyncResult> {
  const pending = await getPendingCheckins();
  if (pending.length === 0) return { attempted: 0, synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch("/api/checkins/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkins: batch.map((c) => ({
            id: c.id,
            registrationId: c.registrationId,
            busId: c.busId,
            stopId: c.stopId,
            direction: c.direction,
            eventType: c.eventType,
            recordedAt: c.recordedAt,
            deviceId: c.deviceId,
            clientCreatedAt: c.clientCreatedAt,
          })),
        }),
      });
      if (!res.ok) {
        failed += batch.length;
        continue;
      }
      const json: { acceptedIds: string[] } = await res.json();
      await markSynced(json.acceptedIds);
      synced += json.acceptedIds.length;
      failed += batch.length - json.acceptedIds.length;
    } catch {
      failed += batch.length;
    }
  }

  return { attempted: pending.length, synced, failed };
}

// ¿Hay señal de verdad? `navigator.onLine` dice "conectado" apenas se saca
// el modo avión o aparece una rayita, varios segundos antes de que los datos
// funcionen. Un POST vacío al endpoint de sync lo confirma contra el server:
// los POST nunca los responde el service worker desde su cache, y además
// valida que la sesión siga abierta.
export async function checkConnection(timeoutMs = 6000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("/api/checkins/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkins: [] }),
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function countPending(): Promise<number> {
  return db.checkins.where("synced").equals(0).count();
}
