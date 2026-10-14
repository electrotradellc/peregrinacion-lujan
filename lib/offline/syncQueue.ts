import { db, getPendingCheckins, markSynced } from "./db";

const BATCH_SIZE = 25;
// Con señal débil un pedido puede quedar colgado para siempre: se corta y se
// reintenta más tarde en vez de dejar el envío "en curso" indefinidamente.
const BATCH_TIMEOUT_MS = 15000;

export interface SyncResult {
  attempted: number;
  synced: number;
  failed: number;
}

let inFlight: Promise<SyncResult> | null = null;

// Manda los check-ins pendientes al server en lotes chicos. Se puede llamar
// las veces que haga falta (al reconectar, periódicamente, a mano) sin riesgo
// de duplicar nada: el server es idempotente tanto por `id` como por la clave
// de negocio (registration_id, bus_id, stop_id, direction, event_type).
// Si ya hay un envío en curso, se espera ese mismo en vez de lanzar otro: con
// señal débil los envíos en paralelo se pisan y la saturan.
export function syncPendingCheckins(): Promise<SyncResult> {
  if (!inFlight) {
    inFlight = runSync().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function runSync(): Promise<SyncResult> {
  const pending = await getPendingCheckins();
  if (pending.length === 0) return { attempted: 0, synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BATCH_TIMEOUT_MS);
    try {
      const res = await fetch("/api/checkins/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
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
      // Sin señal o pedido cortado: no tiene sentido intentar los lotes que
      // siguen en este mismo momento, se reintenta en el próximo ciclo.
      failed += pending.length - i;
      break;
    } finally {
      clearTimeout(timer);
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
