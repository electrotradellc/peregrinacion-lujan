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

export async function countPending(): Promise<number> {
  return db.checkins.where("synced").equals(0).count();
}
