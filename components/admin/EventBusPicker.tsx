"use client";

import { useState } from "react";
import type { BusRow, EventRow } from "@/lib/types";

export function EventBusPicker({ events, buses }: { events: EventRow[]; buses: BusRow[] }) {
  const [eventId, setEventId] = useState("");
  const busesForEvent = buses.filter((b) => b.event_id === eventId);

  return (
    <>
      <div>
        <label className="text-sm font-medium">Evento</label>
        <select
          name="event_id"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="">Sin asignar micro todavía</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium">Micro</label>
        <select
          name="bus_id"
          disabled={!eventId}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
        >
          <option value="">-</option>
          {busesForEvent.map((bus) => (
            <option key={bus.id} value={bus.id}>
              Micro {bus.bus_number}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
