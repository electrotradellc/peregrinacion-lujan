import Dexie, { type EntityTable } from "dexie";
import type { AssignmentDirection, CaptainRosterRow, CheckinEventType } from "@/lib/types";

export interface RosterEntry extends CaptainRosterRow {
  busId: string;
  direction: AssignmentDirection;
  eventId: string;
}

// Un check-in local. `id` se genera en el dispositivo (uuid v4) apenas el
// capitán toca el botón — es la clave de idempotencia de punta a punta: si
// el mismo registro se manda al server una, cinco o cero veces (porque nunca
// hubo señal), el resultado final en Postgres es siempre el mismo.
export interface LocalCheckin {
  id: string;
  registrationId: string;
  busId: string;
  stopId: string;
  direction: AssignmentDirection;
  eventType: CheckinEventType;
  recordedAt: string;
  recordedBy: string;
  deviceId: string;
  clientCreatedAt: string;
  synced: 0 | 1;
}

const db = new Dexie("peregrinacion-captain") as Dexie & {
  roster: EntityTable<RosterEntry, "registration_id">;
  checkins: EntityTable<LocalCheckin, "id">;
};

db.version(1).stores({
  roster: "registration_id, busId, direction, eventId",
  checkins: "id, registrationId, busId, stopId, direction, eventType, synced",
});

export { db };

export function getDeviceId(): string {
  const key = "peregrinacion_device_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export async function saveRoster(entries: RosterEntry[]) {
  await db.roster.bulkPut(entries);
}

export async function getRoster(busId: string, direction: AssignmentDirection) {
  return db.roster.where({ busId, direction }).toArray();
}

// Idempotente también a nivel de UI: un segundo toque sobre el mismo botón
// antes de sincronizar no crea un segundo registro local.
export async function recordCheckin(params: {
  registrationId: string;
  busId: string;
  stopId: string;
  direction: AssignmentDirection;
  eventType: CheckinEventType;
  recordedBy: string;
}): Promise<{ created: boolean }> {
  const existing = await db.checkins
    .where({
      registrationId: params.registrationId,
      busId: params.busId,
      stopId: params.stopId,
      direction: params.direction,
      eventType: params.eventType,
    })
    .first();
  if (existing) return { created: false };

  const now = new Date().toISOString();
  await db.checkins.add({
    id: crypto.randomUUID(),
    registrationId: params.registrationId,
    busId: params.busId,
    stopId: params.stopId,
    direction: params.direction,
    eventType: params.eventType,
    recordedAt: now,
    recordedBy: params.recordedBy,
    deviceId: getDeviceId(),
    clientCreatedAt: now,
    synced: 0,
  });
  return { created: true };
}

export async function getPendingCheckins() {
  return db.checkins.where("synced").equals(0).toArray();
}

export async function markSynced(ids: string[]) {
  await db.checkins.where("id").anyOf(ids).modify({ synced: 1 });
}

export async function isCheckedIn(
  checkins: LocalCheckin[],
  registrationId: string,
  stopId: string,
  direction: AssignmentDirection,
  eventType: CheckinEventType,
) {
  return checkins.some(
    (c) =>
      c.registrationId === registrationId &&
      c.stopId === stopId &&
      c.direction === direction &&
      c.eventType === eventType,
  );
}
